{
  description = "Devshell with Node 22, yarn and turbo";

  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixos-unstable";
    flake-utils.url = "github:numtide/flake-utils";
  };

  outputs = { self, nixpkgs, flake-utils }:
    flake-utils.lib.eachDefaultSystem (system:
      let
        pkgs = import nixpkgs {
          inherit system;
          config = {
            allowUnfree = true;
          };
        };

        yarn = pkgs.yarn-berry.override { nodejs = pkgs.nodejs_22; };

        # knex chdirs into src/ before loading the knexfile, so point dotenv at the backend .env explicitly
        mkBackendScript = name: yarnScript: pkgs.writeShellApplication {
          inherit name;
          runtimeInputs = [ pkgs.nodejs_22 yarn pkgs.git ];
          text = ''
            backend="$(git rev-parse --show-toplevel)/apps/backend"
            cd "$backend"
            DOTENV_CONFIG_PATH="$backend/.env" yarn ${yarnScript} "$@"
          '';
        };

        migrate = mkBackendScript "migrate" "migrations:latest";
        seed = mkBackendScript "seed" "db:seed:all";

        # run from a submodule, show-toplevel would point at the submodule
        repoRoot = ''
          root="$(git rev-parse --show-superproject-working-tree)"
          root="''${root:-$(git rev-parse --show-toplevel)}"
        '';

        sast = pkgs.writeShellApplication {
          name = "sast";
          runtimeInputs = [ pkgs.docker-compose pkgs.curl pkgs.git ];
          text = ''
            export DOCKER_HOST="''${DOCKER_HOST:-unix:///mnt/wsl/podman-sockets/''${PODMAN_MACHINE:-podman-dev-machine}/podman-root.sock}"
            ${repoRoot}
            docker-compose -f "$root/apps/backend/docker-compose.yml" up -d sonarqube

            url="$(sed -n 's/^sonar.host.url=//p' "$root/sonar-project.properties")"
            echo "waiting for SonarQube at $url ..."
            until curl -fs -m 3 "$url/api/system/status" | grep -q '"status":"UP"'; do
              sleep 3
            done
            echo "SonarQube UI ready at $url"
          '';
        };

        # token from SONAR_TOKEN, else the gitignored .sonar-token at the repo root
        sast-analyze = pkgs.writeShellApplication {
          name = "sast-analyze";
          runtimeInputs = [ pkgs.nodejs_22 yarn pkgs.git pkgs.sonar-scanner-cli pkgs.jdk21_headless ];
          text = ''
            ${repoRoot}
            cd "$root"
            if [ -z "''${SONAR_TOKEN:-}" ]; then
              if [ ! -f .sonar-token ]; then
                echo "error: set SONAR_TOKEN or write the token to $root/.sonar-token" >&2
                exit 1
              fi
              SONAR_TOKEN="$(tr -d '[:space:]' < .sonar-token)"
            fi
            export SONAR_TOKEN

            # coverage is written even when a test fails, so analyze anyway
            yarn coverage || echo "warning: tests failed, analyzing with the coverage produced" >&2
            # the JRE and node the server ships are generic linux binaries NixOS can't run, use the nix ones
            export JAVA_HOME="${pkgs.jdk21_headless}"
            sonar-scanner \
              -Dsonar.scanner.skipJreProvisioning=true \
              -Dsonar.nodejs.executable="$(command -v node)" \
              "$@"
          '';
        };

        # zap can't find a browser on nix for manual explore, point its selenium add-on at nix ones
        zap = pkgs.writeShellScriptBin "zap" ''
          exec ${pkgs.zap}/bin/zap \
            -config selenium.firefoxBinary=${pkgs.firefox}/bin/firefox \
            -config selenium.firefoxDriver=${pkgs.geckodriver}/bin/geckodriver \
            "$@"
        '';

        # backend containers and turbo dev side by side in a new tab of the current zellij session
        # turbo dev waits 15s so mongo and postgres accept connections before the backend boots
        run = pkgs.writeShellApplication {
          name = "run";
          runtimeInputs = [ pkgs.zellij pkgs.coreutils ];
          text = ''
            if [ -z "''${ZELLIJ:-}" ]; then
              echo "error: run it from inside a zellij session" >&2
              exit 1
            fi
            compose="$PWD/apps/backend/docker-compose.yml"
            [ -f "$compose" ] || compose="$PWD/docker-compose.yml"

            # panes are spawned by the zellij server, which doesn't have the devshell env
            env="\"PATH=$PATH\" \"CONTAINER_HOST=''${CONTAINER_HOST:-}\" \"DOCKER_HOST=''${DOCKER_HOST:-}\" \"TURBO_TELEMETRY_DISABLED=1\""
            layout="$(mktemp --suffix .kdl)"
            trap 'rm -f "$layout"' EXIT
            cat > "$layout" <<KDL
            layout {
              pane size=1 borderless=true { plugin location="zellij:tab-bar"; }
              pane split_direction="vertical" {
                pane name="backend" command="env" { args $env "podman" "compose" "-f" "$compose" "up"; }
                pane name="dev" command="env" { args $env "${pkgs.bash}/bin/bash" "-c" "sleep 15 && exec turbo dev"; }
              }
              pane size=2 borderless=true { plugin location="zellij:status-bar"; }
            }
            KDL
            zellij action new-tab --name dev --cwd "$PWD" --layout "$layout"
          '';
        };

        lint = pkgs.writeShellApplication {
          name = "lint";
          runtimeInputs = [ pkgs.nodejs_22 yarn pkgs.turbo ];
          text = ''
            TURBO_TELEMETRY_DISABLED=1 turbo run lint --continue "$@"
          '';
        };

        storybook = pkgs.writeShellApplication {
          name = "storybook";
          runtimeInputs = [ pkgs.nodejs_22 yarn pkgs.git ];
          text = ''
            ${repoRoot}
            cd "$root"
            yarn workspace @st-hiring/frontend storybook "$@"
          '';
        };

        # prettier on every source file; `format --check` only reports what would change
        format = pkgs.writeShellApplication {
          name = "format";
          runtimeInputs = [ pkgs.nodejs_22 yarn pkgs.git ];
          text = ''
            ${repoRoot}
            cd "$root"
            if [ "''${1:-}" = "--check" ]; then
              shift
              yarn format:check "$@"
            else
              yarn format "$@"
            fi
          '';
        };

        dependency-check = pkgs.stdenvNoCC.mkDerivation rec {
          pname = "dependency-check";
          version = "13.0.0";
          src = pkgs.fetchzip {
            url = "https://github.com/dependency-check/DependencyCheck/releases/download/v${version}/dependency-check-${version}-release.zip";
            hash = "sha256-ehDwwxKuAyx0J/S6fRlDWfkaVOvNMkLoO5Ls2DjtOfM=";
          };
          nativeBuildInputs = [ pkgs.makeWrapper ];
          installPhase = ''
            mkdir -p $out/share $out/bin
            cp -r . $out/share/dependency-check
            makeWrapper $out/share/dependency-check/bin/dependency-check.sh $out/bin/dependency-check \
              --set JAVA_HOME ${pkgs.jdk21_headless}
          '';
        };

        # NVD rejects anonymous requests, key from NVD_API_KEY, else the gitignored .nvd-api-key at the repo root
        sca = pkgs.writeShellApplication {
          name = "sca";
          runtimeInputs = [ dependency-check pkgs.nodejs_22 yarn pkgs.git ];
          text = ''
            if [ -z "''${NVD_API_KEY:-}" ]; then
              ${repoRoot}
              if [ ! -f "$root/.nvd-api-key" ]; then
                echo "error: set NVD_API_KEY or write it to $root/.nvd-api-key (https://nvd.nist.gov/developers/request-an-api-key)" >&2
                exit 1
              fi
              NVD_API_KEY="$(tr -d '[:space:]' < "$root/.nvd-api-key")"
            fi
            # the NVD db is cached across runs, only the first one downloads it all
            args=(
              --project "$(basename "$PWD")"
              --scan "$PWD"
              --out "$PWD/dependency-check-report"
              --format HTML --format JSON
              --data "''${XDG_CACHE_HOME:-$HOME/.cache}/dependency-check"
              --nvdApiKey "$NVD_API_KEY"
              --exclude "**/node_modules/**" --exclude "**/.git/**" --exclude "**/.yarn/**"
              --exclude "**/dist/**" --exclude "**/coverage/**" --exclude "**/.turbo/**" --exclude "**/.scannerwork/**"
            )
            # OSS Index rejects anonymous requests
            if [ -n "''${OSSINDEX_USER:-}" ]; then
              args+=(--ossIndexUsername "$OSSINDEX_USER" --ossIndexPassword "''${OSSINDEX_TOKEN:-}")
            else
              args+=(--disableOssIndex)
            fi
            dependency-check "''${args[@]}" "$@"
          '';
        };
        # every custom command once: it becomes a flake app, a devshell command and a line of `app-help`
        commands = [
          { drv = run; description = "start the backend containers and turbo dev side by side (inside zellij)"; }
          { drv = migrate; description = "apply pending postgres migrations"; }
          { drv = seed; description = "reset and seed postgres (events, tickets) and mongo (settings)"; }
          { drv = lint; description = "eslint every workspace"; }
          { drv = format; description = "prettier on every source file, --check only reports"; }
          { drv = storybook; description = "frontend storybook on :6006"; }
          { drv = sast; description = "start sonarqube and wait for its ui"; }
          { drv = sast-analyze; description = "run the tests with coverage and send the analysis to sonarqube"; }
          { drv = sca; description = "owasp dependency-check of the current directory"; }
          { drv = zap; description = "owasp zap with firefox wired for manual exploring"; }
        ];

        appHelp = pkgs.writeShellApplication {
          name = "app-help";
          text = ''
            echo "commands (in the devshell, or nix run .#<command>):"
            printf '  %-14s %s\n' app-help "show this list"
            ${pkgs.lib.concatMapStrings (
              { drv, description }:
              "printf '  %-14s %s\\n' ${pkgs.lib.escapeShellArg drv.name} ${pkgs.lib.escapeShellArg description}\n"
            ) commands}
          '';
        };

        allCommands = [ appHelp ] ++ map ({ drv, ... }: drv) commands;
      in
      {
        apps = builtins.listToAttrs (
          map (drv: { name = drv.name; value = flake-utils.lib.mkApp { inherit drv; }; }) allCommands
        );

        devShells.default = pkgs.mkShell {
          packages = allCommands ++ (with pkgs; [
            postman
            nodejs_22
            yarn
            turbo
            podman
            docker-compose
            sonarqube-cli
            sonar-scanner-cli
          ]);

          shellHook = ''
            export TURBO_TELEMETRY_DISABLED=1
            PODMAN_MACHINE="''${PODMAN_MACHINE:-podman-dev-machine}"
            podman_sock="/mnt/wsl/podman-sockets/$PODMAN_MACHINE/podman-root.sock"
            export CONTAINER_HOST="unix://$podman_sock"
            export DOCKER_HOST="$CONTAINER_HOST"
            if [ ! -S "$podman_sock" ]; then
              echo "warning: podman socket not found at $podman_sock (start $PODMAN_MACHINE in Podman Desktop)" >&2
            elif [ ! -w "$podman_sock" ]; then
              echo "warning: no access to $podman_sock (add your user to gid $(stat -c %g "$podman_sock"))" >&2
            fi
            export XDG_DATA_DIRS="${pkgs.gsettings-desktop-schemas}/share/gsettings-schemas/${pkgs.gsettings-desktop-schemas.name}:${pkgs.gtk3}/share/gsettings-schemas/${pkgs.gtk3.name}:$XDG_DATA_DIRS"
          '';
        };
      }
    );
}

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
        seed = mkBackendScript "seed" "db:seed";
      in
      {
        apps = {
          migrate = flake-utils.lib.mkApp { drv = migrate; };
          seed = flake-utils.lib.mkApp { drv = seed; };
        };

        devShells.default = pkgs.mkShell {
          packages = with pkgs; [
            migrate
            seed
            postman
            nodejs_22
            yarn
            turbo
            podman
            docker-compose
          ];

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

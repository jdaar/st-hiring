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
      in
      {
        devShells.default = pkgs.mkShell {
          packages = with pkgs; [
            nodejs_22
            (yarn-berry.override { nodejs = nodejs_22; })
            turbo
          ];

          shellHook = ''
            export TURBO_TELEMETRY_DISABLED=1
          '';
        };
      }
    );
}

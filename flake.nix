{
  description = "Mes courses: development shell (Node 24, pnpm, watchman)";

  inputs.nixpkgs.url = "github:NixOS/nixpkgs/nixos-26.05";

  outputs =
    { nixpkgs, ... }:
    let
      systems = [
        "aarch64-darwin"
        "x86_64-darwin"
        "x86_64-linux"
        "aarch64-linux"
      ];
      forAllSystems = f: nixpkgs.lib.genAttrs systems (system: f nixpkgs.legacyPackages.${system});
    in
    {
      # The Node the Pi runs the server with (research R17): the same one as the dev shell.
      # `nix build .#node --out-link /opt/mes-courses/runtime`.
      packages = forAllSystems (pkgs: {
        node = pkgs.nodejs_24;
      });

      devShells = forAllSystems (pkgs: {
        default = pkgs.mkShellNoCC {
          packages = [
            pkgs.nodejs_24
            pkgs.pnpm
            pkgs.watchman
            pkgs.jq
            pkgs.actionlint
          ];
        };
      });
    };
}

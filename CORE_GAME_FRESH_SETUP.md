# CORE Game — Fresh Setup or a New Computer

Use this guide when setting up CORE Game on another 42 Linux computer, or when the previous checkout/container data is no longer available.

This recreates the demo environment verified on October 24, 2026. It does not restore custom bot code from another computer. Before moving, push your changes to an appropriate remote repository or make a separate backup. Do not rely on `/goinfre` as permanent storage.

## 1. Check the host environment

Run in the normal 42 terminal, outside the container:

```bash
docker info --format 'Server={{.ServerVersion}} Root={{.DockerRootDir}}'
df -h "$HOME" /goinfre
ls -ld "$HOME/.ssh" "$HOME/.gitconfig"
```

Continue when Docker is accessible, sufficient disk space is available, and both paths exist. The upstream container configuration mounts these paths. Docker availability and its storage location may differ on another computer. On the original machine, Docker stored data in `/goinfre/ecakiray/docker` and the home directory was almost full.

## 2. Download and open the project

Run on the host:

```bash
mkdir -p "/goinfre/$USER/coregame"
cd "/goinfre/$USER/coregame"

if [ ! -d monorepo ]; then
    git clone --depth 1 --branch dev \
        https://github.com/42core-team/monorepo.git monorepo
fi

code --install-extension ms-vscode-remote.remote-containers
code "/goinfre/$USER/coregame/monorepo"
```

An existing `monorepo` directory is preserved. The fresh clone contains upstream example bots, not your personal bot changes. Use your own backed-up repository instead if you already have one.

In VS Code, press **Ctrl+Shift+P**, select **Dev Containers: Reopen in Container**, and wait for the build to finish.

## 3. Check the container

Use the VS Code terminal inside the container:

```bash
pwd
cc --version | head -n 1
node --version
go version
```

The expected working directory is `/workspaces/monorepo`. The verified container used GCC 13.3.0, Node.js 22, and Go 1.26.0. All remaining commands run inside this container.

## 4. Apply demo compatibility fixes

The upstream C examples requested components missing from `fake_demo`. Apply these replacements to the upstream example bots. Repeating them is harmless; customized source may need manual review.

```bash
cd /workspaces/monorepo

sed -i \
  's/core_action_createUnit("Warrior", "combat", NULL);/core_action_createUnit("Warrior", "core_attack", NULL);/' \
  bots/c/bot/my-core-bot/src/main.c

sed -i \
  's/core_action_createUnit("Gridfighter", "combat", "siege", "health", NULL);/core_action_createUnit("Gridfighter", "core_attack", "health", NULL);/' \
  bots/c/bot/gridmaster/src/main.c

mkdir -p replays visualizer/public/replays

node <<'JS'
const fs = require("node:fs");
const path = "bots/configs/fake_demo/server.config.json";
const config = JSON.parse(fs.readFileSync(path, "utf8"));

config.replayFolderPaths = [
    "/workspaces/monorepo/replays",
    "/workspaces/monorepo/visualizer/public/replays"
];

fs.writeFileSync(path, JSON.stringify(config, null, 4) + "\n");
JS
```

These are demo compatibility changes. Actual competition components and balance settings still need verification.

## 5. Install visualizer dependencies

```bash
cd /workspaces/monorepo/visualizer
npm_config_cache="/workspaces/monorepo/.npm-cache" npm install
```

The original install reported four high-severity dependency vulnerabilities. No dependency upgrades or audit fixes were tested during setup.

## 6. Build and start a match — terminal A

```bash
cd /workspaces/monorepo
make -o configs LANGUAGE=c STAGE=dev JOBS=4
```

This builds the C client library, example bots, and game server, then starts the match. The default team IDs are 42 and 418.

`-o configs` skips the inaccessible configuration submodule download. It does not force the demo configuration: if real configuration files exist, the main Makefile can select them. Check the server launch command to see which files are used.

Run one match at a time. The main Makefile uses name-based process termination when starting a match.

## 7. Start the visualizer — terminal B

Open a second terminal inside the same container:

```bash
cd /workspaces/monorepo/visualizer
npm run dev -- --host 0.0.0.0 --port 4242 --strictPort
```

Keep this terminal running.

In VS Code, open **Ports**, find or forward container port **4242**, then select **Open in Browser**. Use its actual forwarded address. During the original session, the working address was:

[http://localhost:4243/index.html](http://localhost:4243/index.html)

The host port may differ. If `localhost:4242` displays `{'ftpkg-srv'}`, use the address in VS Code's Ports panel instead.

Press **Play** to advance the replay. Adjust **Ticks/sec** for speed, and use `Ctrl+-` if the map does not fit. Refresh after a new match to check the latest replay.

## 8. Verify replay output

In another container terminal, or after the match finishes:

```bash
ls -lh /workspaces/monorepo/replays \
       /workspaces/monorepo/visualizer/public/replays
```

The verified replay filename is `replay_latest.json`. Check its modification time and server logs before assuming it belongs to the latest match. Browser replay playback was verified; live viewing of ongoing matches was not.

## Scope

This guide covers the tested C example match and replay workflow. The proposed `tools/match.sh` opponent selector was not yet verified. Go and mixed-language matches were not tested. All project code, comments, script messages, and documentation should use English.

## References

- [CORE Game](https://coregame.sh/)
- [Wiki](https://coregame.sh/wiki)
- [Monorepo](https://github.com/42core-team/monorepo)

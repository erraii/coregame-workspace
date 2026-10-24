# CORE Game — Restart on the Same Computer

Use this guide after closing VS Code, logging out, or restarting the computer, provided the repository and Docker data are still available.

The setup, component fixes, and replay paths must already have been configured. If they are missing, follow `CORE_GAME_FRESH_SETUP.md` instead.

## 1. Open the project — host terminal

Run in the normal 42 terminal:

```bash
docker info --format 'Server={{.ServerVersion}} Root={{.DockerRootDir}}'
ls -ld "/goinfre/$USER/coregame/monorepo"
code "/goinfre/$USER/coregame/monorepo"
```

Docker must be accessible. If VS Code opens outside the container, press **Ctrl+Shift+P** and select **Dev Containers: Reopen in Container**. Reuse the existing container when available; rebuilding it is not normally needed just to start another match.

## 2. Start a match — container terminal A

```bash
cd /workspaces/monorepo
make -o configs LANGUAGE=c STAGE=dev JOBS=4
```

This builds what is needed and starts the C example match. No repeated cloning, component replacement, or replay configuration is required.

`-o configs` skips the configuration submodule download. It does not force demo settings if real configuration files have since become available. Check the paths printed in the server launch command.

Run one match at a time. If an earlier match is still running, stop it with `Ctrl+C` in its terminal before starting another.

## 3. Start the visualizer — container terminal B

Open another terminal inside the container:

```bash
cd /workspaces/monorepo/visualizer
npm run dev -- --host 0.0.0.0 --port 4242 --strictPort
```

Keep it running while using the browser. `Ctrl+C` stops the visualizer server.

## 4. Open the forwarded browser address

In VS Code:

1. Open the **Ports** panel.
2. Find container port **4242**, or add it with **Forward a Port**.
3. Select **Open in Browser** for that row.

The original working address was:

[http://localhost:4243/index.html](http://localhost:4243/index.html)

The forwarded host port may change. Use the Ports panel's actual address instead of assuming port 4242 or 4243.

Press **Play**, adjust **Ticks/sec**, and refresh the page after each new match. If the map does not fit, use `Ctrl+-` to zoom out.

## 5. Check the latest replay

```bash
ls -lh /workspaces/monorepo/replays \
       /workspaces/monorepo/visualizer/public/replays
```

Look for `replay_latest.json` and check its modification time. An old replay can remain after a failed new match; use the server logs to confirm the match outcome. Replay playback works; live viewing has not been verified.

## Recovery

### Visualizer dependencies are missing

Run in the container:

```bash
cd /workspaces/monorepo/visualizer
npm_config_cache="/workspaces/monorepo/.npm-cache" npm install
npm run dev -- --host 0.0.0.0 --port 4242 --strictPort
```

### Port 4242 is already occupied inside the container

First check whether the visualizer is already running in another terminal. If so, reuse it. Otherwise, select another port:

```bash
cd /workspaces/monorepo/visualizer
npm run dev -- --host 0.0.0.0 --port 4343 --strictPort
```

Forward container port **4343** in VS Code and open that row's forwarded address.

### The source folder or container data is gone

Use `CORE_GAME_FRESH_SETUP.md`. Restore personal bot changes from your backup or remote Git repository. A fresh upstream clone will not contain those changes.

## Daily command reference

| Purpose | Command / action |
| --- | --- |
| Open the project on the host | `code "/goinfre/$USER/coregame/monorepo"` |
| Enter the container | **Dev Containers: Reopen in Container** |
| Start the C example match | `cd /workspaces/monorepo && make -o configs LANGUAGE=c STAGE=dev JOBS=4` |
| Start the visualizer | `cd /workspaces/monorepo/visualizer && npm run dev -- --host 0.0.0.0 --port 4242 --strictPort` |
| Open the browser | VS Code **Ports → Open in Browser** |
| Load a new replay | Refresh the browser after the match |

This workflow covers the verified C example setup. Opponent selection through the proposed `tools/match.sh` and matches using other languages have not yet been verified.

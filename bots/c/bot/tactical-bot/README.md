# CORE tactical bot

See TACTICAL_CARRIERS.md in the repository root for the measured comparison, carrier mechanics, limits, and exact play commands. This is a handwritten tactical variant; it does not replace the preserved trained strategy or its checkpoint.

Build with the existing compatible CORE C client library:

```bash
make CLIENT_LIB_DIR=/absolute/path/to/bots/c/client_lib
```

The default disables carriers because both carrier variants tied in reference win fitness and the predeclared tie rule preferred the simpler variant. To build with carriers, rebuild every object so changed flags take effect:

```bash
make -B CLIENT_LIB_DIR=/absolute/path/to/bots/c/client_lib CFLAGS="-Wall -Wextra -Werror -g -fsanitize=address -DENABLE_CARRIERS=1"
```

Use the supplied supported_game_config.json (the inspected fake_demo rules). Source costs/roles are configuration-specific. Parameters are embedded in headers; no Python/Node/model download is needed for inference. Node is used only by the local evaluation tooling. Run ./bot TEAM_ID after the compatible server is listening.

#!/bin/sh
# Keeps the doc2vid channel's interactive Claude Code session alive in tmux and answers its startup
# prompts. It runs as a LaunchAgent because Claude Code can read the login keychain only from the
# GUI login session, not from an ssh shell.
set -u
t() { /opt/homebrew/bin/tmux -L doc2vid "$@"; }
if ! t has-session -t agent 2>/dev/null; then
  t new-session -d -s agent -x 200 -y 50 -c "$HOME/doc2vid/agent" \
    "$HOME/.local/bin/claude --model ${AGENT_MODEL:-claude-opus-5-5} --setting-sources project --strict-mcp-config --mcp-config $HOME/.config/doc2vid/channel-mcp.json --dangerously-load-development-channels server:doc2vid --dangerously-skip-permissions --disallowedTools WebFetch WebSearch"
  i=0
  while [ "$i" -lt 60 ]; do
    sleep 2; i=$((i + 1))
    screen=$(t capture-pane -p -t agent 2>/dev/null) || break
    case "$screen" in
      # First start in this folder; the default answer is "No, exit".
      *"Yes, I trust this folder"*) t send-keys -t agent Down; sleep 0.3; t send-keys -t agent Enter ;;
      # The default keeps the owner's personal AGENTS.md out of this session.
      *"Allow external CLAUDE.md file imports"*) t send-keys -t agent Enter ;;
      *"I am using this for local development"*) t send-keys -t agent Enter ;;
      *"Yes, I accept"*) t send-keys -t agent Down; sleep 0.3; t send-keys -t agent Enter ;;
      *"bypass permissions on"*) break ;;
    esac
  done
fi
# Stay alive while the session exists, so launchd (KeepAlive) starts a new one if Claude Code exits.
while t has-session -t agent 2>/dev/null; do sleep 20; done

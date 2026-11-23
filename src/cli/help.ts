export const HELP_TEXT = `
Codgent: a coding agent for your terminal

USAGE
  codgent                      interactive mode: chat that remembers the conversation
  codgent -p "fix the bug"     print mode: do the task, print the answer, exit

CHAT COMMANDS
  /help             show this help
  /clear            forget the conversation and start a new session
  /exit             quit (Ctrl-D also works)

OPTIONS
  -p, --prompt <text>        print mode: run once and exit
  --provider <name>          openRouter (default), groq, groqadv, anthropic
  --model <id>               override the provider's default model
  -r, --resume               resume the latest session
  -s, --session <id>         resume a specific session
  --list-sessions            list saved sessions and exit
  --context-limit <tokens>   compact the chat when it nears this size (default 100000)
  --yolo                     run tools without asking permission
  -h, --help                 show this help

TOOLS
  read    reads files, runs without asking
  bash    runs shell commands, asks first (y / n)

GOOD TO KNOW
- AGENTS.md or CLAUDE.md in the current folder is loaded as project instructions.
- Long chats are compacted automatically; the full history stays in the session file.
- In print mode, answers go to stdout and everything else to stderr, so piping gives clean output.

EXAMPLES
  codgent --provider groq -p "list the TODOs in src/"
  codgent -r                   continue where you left off
  codgent -s <id>              pick a past conversation (see --list-sessions)
`;

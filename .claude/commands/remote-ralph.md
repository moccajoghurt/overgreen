## Remote Ralph — VPS Claude Code Runner

Connect to the remote VPS and manage Ralph loops running there.

### VPS Details
- **Host**: 89.58.58.182
- **User**: ralph (non-root, required for --dangerously-skip-permissions)
- **Root password**: Ba7Yq4p31EqkheW
- **OS**: Debian 10 (buster), 4 vCPUs (QEMU), 4GB RAM
- **Node**: v20 via nvm at /home/ralph/.nvm
- **Claude Code**: installed globally via npm
- **Repo**: /home/ralph/overgreen (cloned from GitHub)
- **tmux session**: ralph

### Common Operations

**Check if Ralph is running:**
```bash
ssh -o StrictHostKeyChecking=no root@89.58.58.182 "ps -eo pid,etime,args | grep claude | grep -v grep"
```

**Check latest commits in worktree:**
```bash
ssh -o StrictHostKeyChecking=no root@89.58.58.182 "su - ralph -c 'cd ~/overgreen/.claude/worktrees/\$(ls -t ~/overgreen/.claude/worktrees/ | head -1) && git log --oneline -10'"
```

**View tmux output:**
```bash
ssh -o StrictHostKeyChecking=no root@89.58.58.182 "su - ralph -c 'tmux capture-pane -t ralph -p -S -50'"
```

**Push worktree commits to GitHub** (from local machine):
```bash
git fetch server ralph/<branch> && git push origin server/ralph/<branch>:refs/heads/ralph/<branch>
```
Note: The local repo has a `server` remote pointing to the VPS repo.

**Start a new Ralph loop on VPS:**
1. Push latest main to GitHub
2. Pull on VPS: `ssh root@89.58.58.182 "su - ralph -c 'cd ~/overgreen && git pull'"`
3. Create tmux session: `ssh root@89.58.58.182 "su - ralph -c 'tmux new-session -d -s ralph'"`
4. Start ralph.sh: `ssh root@89.58.58.182 "su - ralph -c \"tmux send-keys -t ralph 'cd ~/overgreen && ./ralph.sh' Enter\""`

**Attach interactively:**
```bash
ssh -t root@89.58.58.182 "su - ralph -c 'tmux attach -t ralph'"
```

### Troubleshooting
- Claude must run as non-root user `ralph` (--dangerously-skip-permissions blocked for root)
- nvm is in /home/ralph/.nvm, loaded via .bashrc before the interactive guard
- GitHub push requires going through local machine (no GitHub credentials on VPS)
- `server` git remote on local: ssh://root@89.58.58.182/home/ralph/overgreen

### Instructions
When the user asks to check on remote Ralph, run the status commands above and report:
1. Is the claude process running? How long has it been up?
2. What iteration is it on? (check git log in latest worktree)
3. What's the current score? (check RALPH-PROGRESS.md)
4. Are there any stuck/long-running scripts? (check ps for tsx/node processes)
5. Push new commits to GitHub if requested

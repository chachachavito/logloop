# Debugging & Troubleshooting

## Common Issues
- **Git Hook Permissions**: Ensure `.git/hooks` is writable if log interception fails.
- **Prisma Synchronization**: Run `npx prisma generate` in `dashboard/backend` after schema changes.
- **Port Conflicts**: Dashboard uses standard ports (3000/3001). Check `lsof -i :3000` if it fails to start.

## Logs
- Internal logs are stored in `.logloop/` within the project root.

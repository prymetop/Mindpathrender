# MindPath Next Steps

## Owner tasks before deployment

- Create/confirm Telegram bot
- Obtain owner Telegram numeric ID
- Create Cloudflare account if using Workers
- Create D1 database
- Obtain an AI API key
- Configure production secrets
- Add the channel IDs that MindPath is allowed to monitor

## Development tasks

### Stage 1
Verify:
- `/start`
- `/help`
- `/status`
- `/reset`
- normal text
- image input
- persistence after worker restart
- rejection of non-owner private messages

### Stage 2
Add:
- research provider
- source handling
- current-information verification

### Stage 3
Add:
- Google Drive OAuth
- authorized root-folder enforcement
- read-only operations first
- explicit write authorization

### Stage 4
Add:
- long-term memory
- task/reminder records
- notification preferences

### Stage 5
Add:
- email adapter
- scheduled jobs
- daily/weekly summaries

### Stage 6
Add:
- GitHub adapter
- project context
- development tools

## Important architecture rule

If a feature can be done deterministically, do it without an AI request.

Example:
- URL detection → code
- Telegram URL filtering → code
- owner ID check → code
- permission check → code
- duplicate event check → database

AI should be used where reasoning is actually needed.

# Command Framework Implementation
Current Working Directory: c:/Users/USER/whspr_stellar/src/command-framework/

## Plan Steps (Approved)

### 1. Create module structure & core files [COMPLETE ✓]
- `src/command-framework/command-framework.module.ts`
- `entities/bot-command.entity.ts`
- `command-framework.service.ts` (parse/register/route/built-ins/dispatch)
- `command-framework.controller.ts`
- DTOs: register-command.dto.ts, execute-command.dto.ts, paginated-commands.dto.ts

### 2. Database & entity [READY ✓]
- Migration: `src/migrations/1747000000000-CommandFrameworkBotCommands.ts` (with built-in seeds)

### 3. Integrate with message flow [TODO]
- Hook into `src/Conversation Module/src/conversations/services/conversations.service.ts#sendMessage`
- Inject CommandFrameworkService, parse/route on `/` commands

### 4. Tests [TODO]
- `src/command-framework/__tests__/command-framework.service.spec.ts`
- `test/command-framework.e2e-spec.ts`

### 5. App integration & updates [TODO]
- Update `src/app.module.ts`
- Update `src/bots/entities/bot-command.entity.ts`? (add fields)

### 6. Followup/Verification [TODO]
- Run migration
- `npm run test`
- Benchmark parse/route <100ms
- Test built-ins: `/pay`, `/balance`, `/help`

**Next step: Step 2 - Run migration \`npm run typeorm migration:run\`, then Step 3 integration.**


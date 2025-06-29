# SyntaxisAI Backend

This README provides information about available scripts and development instructions.

## Scripts

| Script | Description |
| ------ | ----------- |
| `npm run dev` | Start development server with nodemon and TypeScript. |
| `npm run start` | Start compiled server from `dist`. |
| `npm run build` | Compile TypeScript source into `dist` directory. |
| `npm test` | Run all Jest tests. |
| `npm run test:watch` | Run Jest in watch mode. |
| `npm run test:coverage` | Run Jest with coverage reporting. |
| `npm run lint` | Run ESLint checks. |
| `npm run lint:fix` | Run ESLint with auto-fix. |
| `npm run format` | Format code using Prettier. |
| `npm run clean` | Remove the `dist` directory. |
| `npm run typecheck` | Run TypeScript compiler without emitting files. |

## Development Setup

1. Install dependencies:
   ```bash
   cd backend
   npm install
   ```
2. Copy `.env.example` to `.env` and configure environment variables.
3. Set up the database with Prisma:
   ```bash
   npx prisma migrate dev
   npx prisma generate
   ```
4. Run the development server:
   ```bash
   npm run dev
   ```
5. Open http://localhost:3001 in your browser.

## Database and Prisma

The backend uses PostgreSQL with Prisma ORM for database management:
- **Schema**: Defined in `prisma/schema.prisma`
- **Migrations**: Located in `prisma/migrations/`
- **Seeding**: Run `npx prisma db seed` for test data

## Testing Strategy

See `docs/testing.md` for a detailed explanation of the testing approach, test types, and fixtures. 
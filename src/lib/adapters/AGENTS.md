Wire schemas (`*.wire.ts`) live here. Validate with Zod, map to domain, degrade-not-throw, never leak wire types upward. Live network calls forbidden in tests - use fixtures.

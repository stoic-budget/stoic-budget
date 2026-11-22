import type { DynamicModule, Type } from '@nestjs/common';

/**
 * Modules a paid edition adds to the app. The open-source build ships none.
 *
 * A paid build copies its own files over this tree before building, this one
 * included; nothing is loaded at run time. A module that plugs into a core
 * service through a token (`TAX_DEADLINE_SOURCE`) is `@Global()` and exports it.
 */
export const EXTENSION_MODULES: Array<Type | DynamicModule> = [];

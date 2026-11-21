import { SetMetadata } from '@nestjs/common';

export const ALLOW_IN_DEMO_KEY = 'allowInDemo';

/**
 * A write a demo instance still answers: signing in and out, and the small
 * in-place upserts the UI makes on its own (hints seen, a layout, a vote).
 * Only for writes that cannot make a table grow with each visitor.
 */
export const AllowInDemo = () => SetMetadata(ALLOW_IN_DEMO_KEY, true);

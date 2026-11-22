import { SetMetadata } from '@nestjs/common';

export const ALLOW_IN_DEMO_KEY = 'allowInDemo';

/**
 * A write a demo instance still answers: signing in and out, and the small
 * in-place upserts the UI makes on its own (hints seen, a layout, a vote).
 * Only for writes that cannot make a table grow with each visitor.
 */
export const AllowInDemo = () => SetMetadata(ALLOW_IN_DEMO_KEY, true);

export const REFUSE_IN_DEMO_KEY = 'refuseInDemo';

/**
 * A write a demo instance refuses even though `@AllowInVersion` lets it into
 * a past version: opening or copying a version builds a whole workspace.
 */
export const RefuseInDemo = () => SetMetadata(REFUSE_IN_DEMO_KEY, true);

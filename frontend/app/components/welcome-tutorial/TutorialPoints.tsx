'use client';

import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import type React from 'react';
import { useIntlayer } from '@/app/i18n';
import { blurInSx } from './welcome-tutorial.styles';
import { pointsSx, pointTextSx, pointTitleSx } from './welcome-tutorial-step.styles';
import type { TutorialStep } from './welcome-tutorial-steps';

interface PointText {
  title: React.ReactNode;
  text: React.ReactNode;
}

/** What is on the page, as a plain list: a short title and one line each. */
export function TutorialPoints({
  step,
  firstOrder,
}: {
  step: TutorialStep;
  /** Where in the page's entrance the first point comes. */
  firstOrder: number;
}): React.JSX.Element {
  const { steps } = useIntlayer('welcomeTutorialSteps');
  const texts = steps[step.id].points as unknown as Record<string, PointText>;
  return (
    <Box component="ul" sx={pointsSx}>
      {step.points.map((id, index) => (
        <Box component="li" key={id} sx={blurInSx(firstOrder + index)}>
          <Typography sx={pointTitleSx}>{texts[id].title}</Typography>
          <Typography sx={pointTextSx}>{texts[id].text}</Typography>
        </Box>
      ))}
    </Box>
  );
}

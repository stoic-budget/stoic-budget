'use client';

import { McpClientRegistrationCard } from './McpClientRegistrationCard';
import { RegistrationCard } from './RegistrationCard';

/** Who may sign up: people without an invitation, and MCP apps. */
export function RegistrationCards() {
  return (
    <>
      <RegistrationCard />
      <McpClientRegistrationCard />
    </>
  );
}

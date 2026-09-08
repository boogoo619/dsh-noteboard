/**
 * Ambient types for @deepseek-ai/dsh-client-ui-primitives — the browser-side
 * design-system package provided at runtime by the dsh web frontend (the
 * plugin's `dsh.client.inject` already lists it). Only what the settings card
 * uses is declared.
 */
declare module '@deepseek-ai/dsh-client-ui-primitives' {
  import type { ComponentType } from 'react'
  export const IconSendOutline14: ComponentType<{ size?: number }>
  export const IconChevronDownOutline14: ComponentType<{ size?: number }>
  export const Button: ComponentType<{
    variant?: 'primary' | 'outline' | 'ghost' | 'danger'
    size?: 'sm' | 'md'
    disabled?: boolean
    onClick?: (e?: unknown) => void
    children?: unknown
  }>
}

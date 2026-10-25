import { createNavigation } from 'next-intl/navigation'
import { routing } from './routing'

export const { Link, usePathname, redirect, getPathname } = createNavigation(routing)

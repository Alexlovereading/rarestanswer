/**
 * One published mailbox for the contact, legal, and llms.txt pages.
 * `site.contactEmail` stays empty until the mailbox is confirmed (the
 * apply-template drift guard reads that empty literal). When it is set,
 * every page uses it. Until then they share the placeholder below.
 */
import { site } from '~/config/site';

export const PLACEHOLDER_CONTACT_EMAIL = 'contact@rarestanswer.com';

export function contactEmail(): string {
  const configured = site.contactEmail?.trim() ?? '';
  return configured || PLACEHOLDER_CONTACT_EMAIL;
}

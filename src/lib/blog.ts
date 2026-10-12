/** Blog post metadata. Bodies live in src/content/blog/<post>.tsx; the sitemap script reads the same JSON. */
import posts from "@/content/blog/posts.json";

export type BlogPostMeta = {
  slug: string;
  title: string;
  /** Short name for cards, breadcrumbs and in-text links. */
  shortTitle: string;
  description: string;
  tag: string;
  date: string;
  updated: string;
  readMinutes: number;
};

export const BLOG_POSTS = posts as BlogPostMeta[];

export const getBlogPost = (slug: string) => BLOG_POSTS.find((p) => p.slug === slug);

export const blogUrl = (slug: string) => `https://kachkivun.com/blog/${encodeURIComponent(slug)}`;

export function formatPostDate(iso: string) {
  return new Date(`${iso}T12:00:00Z`).toLocaleDateString("he-IL", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
}

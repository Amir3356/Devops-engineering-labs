import { pick, toStr, listOf } from './_fields';

/**
 * @typedef {Object} Category
 * @property {string} id
 * @property {string} name
 * @property {string} slug
 * @property {string} description
 */

const slugify = (text) =>
  text.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');

/** Accepts a category object or a bare category name string. */
export const createCategory = (raw = {}) => {
  if (typeof raw === 'string') raw = { name: raw };
  const name = toStr(pick(raw, 'name'));
  return {
    id: toStr(pick(raw, 'id'), slugify(name)),
    name,
    slug: toStr(pick(raw, 'slug'), slugify(name)),
    description: toStr(pick(raw, 'description')),
  };
};

export const createCategoryList = listOf(createCategory);

export const categoryFormToApi = (form) => ({
  name: toStr(form.name),
  slug: slugify(toStr(form.name)),
  description: toStr(form.description),
});

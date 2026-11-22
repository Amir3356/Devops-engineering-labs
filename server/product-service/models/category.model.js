/**
 * Category Model / Entity
 */
class CategoryModel {
  constructor({ id, name, slug, description }) {
    this.id = id || `cat-${name.toLowerCase().replace(/[^a-z0-9]/g, '-')}`;
    this.name = name;
    this.slug = slug || name.toLowerCase().replace(/[^a-z0-9]/g, '-');
    this.description = description || '';
  }

  toJSON() {
    return {
      id: this.id,
      name: this.name,
      slug: this.slug,
      description: this.description
    };
  }
}

export default CategoryModel;

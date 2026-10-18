export const EDITABLE_FIELDS = [
  'title', 'template', 'themeColor', 'fontFamily', 'personal', 'education', 'experience',
  'internships', 'projects', 'certifications', 'achievements', 'skills', 'languages',
  'socialLinks', 'references',
];

export const pickEditable = (body = {}) =>
  Object.fromEntries(
    EDITABLE_FIELDS.filter((key) => Object.prototype.hasOwnProperty.call(body, key)).map((key) => [key, body[key]])
  );

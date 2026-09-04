// Turn a raw Shopify product into a catalog item: one clean record per variant
// with color, size, price, stock and image resolved.

const SIZE_RE = /#\s*(\d{1,2})\b/;

export function normalizeSize(s) {
  if (s == null) return null;
  const m = String(s).match(SIZE_RE) || String(s).trim().match(/^(\d{1,2})$/);
  return m ? `#${m[1]}` : null;
}

/** "Olive #18" -> { color: "Olive", size: "#18" }; "#14" -> { size }; "Amber" -> { color } */
export function splitColorSize(text) {
  if (!text) return {};
  const size = normalizeSize(text);
  let color = String(text).replace(SIZE_RE, '').replace(/^\s*-\s*/, '').trim();
  if (/^\d{1,2}$/.test(color)) color = '';
  return { color: color || null, size };
}

function optionKind(name) {
  const n = String(name || '').toLowerCase();
  if (/colou?r|coloe/.test(n) && /size/.test(n)) return 'both';
  if (/size/.test(n)) return 'size';
  if (/colou?r|coloe/.test(n)) return 'color';
  return null;
}

function imageUrl(src) {
  if (!src) return null;
  if (src.startsWith('//')) return 'https:' + src;
  return src;
}

/** Thumbnail URL at a given width. Shopify CDN honours ?width= on files/ URLs. */
export function thumb(src, width = 240) {
  if (!src) return null;
  const u = new URL(src);
  u.searchParams.set('width', String(width));
  return u.toString();
}

export function normalizeProduct(raw, { storeUrl }) {
  // Title suffix carries color/size when the product has a single "Title" option: "Bubbleback Caddis - #14".
  const [baseTitle, suffix] = splitTitle(raw.title);
  const fromTitle = splitColorSize(suffix);
  const images = (raw.images || []).map(i => imageUrl(typeof i === 'string' ? i : i.src)).filter(Boolean);
  const imageById = new Map((raw.images || []).filter(i => i && i.id).map(i => [i.id, imageUrl(i.src)]));
  const options = (raw.options || []).map(o => ({ name: o.name, values: o.values || [] }));
  const kinds = options.map(o => optionKind(o.name));
  const taxonomy = (raw.tags || []).filter(t => /^Flies\//.test(t)).map(t => t.split('/').slice(1));

  const variants = (raw.variants || []).map(v => {
    let color = null, size = null;
    const vals = [v.option1, v.option2, v.option3];
    kinds.forEach((k, i) => {
      const val = vals[i];
      if (!val || val === 'Default Title') return;
      if (k === 'size') size = size || normalizeSize(val);
      else if (k === 'color') color = color || val.trim();
      else if (k === 'both') { const cs = splitColorSize(val); color = color || cs.color; size = size || cs.size; }
    });
    color = color || fromTitle.color || null;
    size = size || fromTitle.size || null;
    const featured = v.featured_image ? imageUrl(v.featured_image.src) : (v.image_id && imageById.get(v.image_id)) || null;
    return {
      id: v.id,
      sku: v.sku || null,
      title: v.title,
      color, size,
      price: Number(v.price),
      available: v.available !== false,
      image: featured || images[0] || null,
      url: `${storeUrl}/products/${raw.handle}?variant=${v.id}`,
    };
  });

  return {
    id: raw.id,
    handle: raw.handle,
    title: raw.title,
    baseTitle,
    vendor: raw.vendor || null,
    type: raw.product_type || null,
    tags: raw.tags || [],
    taxonomy,
    url: `${storeUrl}/products/${raw.handle}`,
    image: images[0] || null,
    images,
    options,
    colors: [...new Set(variants.map(v => v.color).filter(Boolean))],
    sizes: [...new Set(variants.map(v => v.size).filter(Boolean))],
    priceMin: Math.min(...variants.map(v => v.price)),
    priceMax: Math.max(...variants.map(v => v.price)),
    variants,
  };
}

/** "Peaches 'n Green - Olive #18" -> ["Peaches 'n Green", "Olive #18"] */
export function splitTitle(title) {
  const m = String(title || '').match(/^(.*?)\s+-\s+([^-]+)$/);
  return m ? [m[1].trim(), m[2].trim()] : [String(title || '').trim(), ''];
}

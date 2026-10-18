/**
 * Plain-English short names for the Harmonized System's 2-digit chapters, as
 * the goods-by-product files use them (`trade_products_*`). Census's own chapter
 * descriptions are truncated capitals ("ELECTRIC MACHINERY ETC; SOUND EQUIP; TV
 * EQUIP; PTS"); these are the names a reader uses. Hand-written; keyed by the
 * two-digit chapter code. Chapter 77 is reserved in the HS and never appears.
 *
 * `kind`:
 * - `goods`: an ordinary product chapter.
 * - `special`: Chapters 98 and 99, the U.S.-only "special classification
 *   provisions". They are not a kind of product: they hold returned American
 *   goods, goods brought back after repair or assembly abroad, Census's
 *   estimates of low-value shipments that are not filed one by one, and other
 *   entries classified by how they cross the border rather than what they are.
 *   They are part of every total (the chapters sum to the country's total only
 *   with them), so they are kept, but a "top products" list should skip them or
 *   name them as what they are. See docs/TRADE_METHODOLOGY.md.
 *
 * The transform fails if the data carries a chapter missing from this table.
 */
export interface HsChapter {
  name: string;
  kind: "goods" | "special";
}

const g = (name: string): HsChapter => ({ name, kind: "goods" });

export const HS_CHAPTERS: Readonly<Record<string, HsChapter>> = {
  "01": g("Live animals"),
  "02": g("Meat"),
  "03": g("Fish & seafood"),
  "04": g("Dairy, eggs & honey"),
  "05": g("Other animal products"),
  "06": g("Plants & cut flowers"),
  "07": g("Vegetables"),
  "08": g("Fruit & nuts"),
  "09": g("Coffee, tea & spices"),
  "10": g("Grain"),
  "11": g("Flour, malt & starch"),
  "12": g("Soybeans & other oilseeds"),
  "13": g("Plant gums & resins"),
  "14": g("Plant materials for weaving"),
  "15": g("Fats & cooking oils"),
  "16": g("Prepared meat & fish"),
  "17": g("Sugar & candy"),
  "18": g("Cocoa & chocolate"),
  "19": g("Bread, pasta & cereal foods"),
  "20": g("Prepared fruit & vegetables"),
  "21": g("Other prepared foods"),
  "22": g("Drinks & alcohol"),
  "23": g("Animal feed"),
  "24": g("Tobacco"),
  "25": g("Salt, stone & cement"),
  "26": g("Metal ores"),
  "27": g("Oil, gas, coal & fuels"),
  "28": g("Inorganic chemicals"),
  "29": g("Organic chemicals"),
  "30": g("Pharmaceuticals"),
  "31": g("Fertilizers"),
  "32": g("Paints, dyes & inks"),
  "33": g("Cosmetics & perfume"),
  "34": g("Soap, wax & cleaning products"),
  "35": g("Glues & enzymes"),
  "36": g("Explosives & fireworks"),
  "37": g("Photographic & film supplies"),
  "38": g("Other chemical products"),
  "39": g("Plastics"),
  "40": g("Rubber & tires"),
  "41": g("Hides & leather"),
  "42": g("Leather goods & handbags"),
  "43": g("Furs"),
  "44": g("Wood & lumber"),
  "45": g("Cork"),
  "46": g("Basketwork"),
  "47": g("Wood pulp"),
  "48": g("Paper & cardboard"),
  "49": g("Books & printed matter"),
  "50": g("Silk"),
  "51": g("Wool"),
  "52": g("Cotton"),
  "53": g("Other plant fibers"),
  "54": g("Synthetic filament & yarn"),
  "55": g("Synthetic staple fibers"),
  "56": g("Felt, twine & rope"),
  "57": g("Carpets & rugs"),
  "58": g("Special fabrics & lace"),
  "59": g("Coated & industrial fabrics"),
  "60": g("Knit fabrics"),
  "61": g("Knit clothing"),
  "62": g("Woven clothing"),
  "63": g("Home textiles & used clothing"),
  "64": g("Footwear"),
  "65": g("Hats"),
  "66": g("Umbrellas & canes"),
  "67": g("Wigs & artificial flowers"),
  "68": g("Stone & cement articles"),
  "69": g("Ceramics"),
  "70": g("Glass"),
  "71": g("Gold, gems & jewelry"),
  "72": g("Iron & steel"),
  "73": g("Iron & steel products"),
  "74": g("Copper"),
  "75": g("Nickel"),
  "76": g("Aluminum"),
  "78": g("Lead"),
  "79": g("Zinc"),
  "80": g("Tin"),
  "81": g("Other base metals"),
  "82": g("Tools & cutlery"),
  "83": g("Other metal products"),
  "84": g("Machinery & computers"),
  "85": g("Electronics & electrical equipment"),
  "86": g("Railway equipment"),
  "87": g("Vehicles & parts"),
  "88": g("Aircraft & spacecraft"),
  "89": g("Ships & boats"),
  "90": g("Medical, optical & scientific instruments"),
  "91": g("Clocks & watches"),
  "92": g("Musical instruments"),
  "93": g("Arms & ammunition"),
  "94": g("Furniture, bedding & lighting"),
  "95": g("Toys, games & sports equipment"),
  "96": g("Other manufactured goods"),
  "97": g("Art & antiques"),
  "98": { name: "Special entries (returns, repairs, low-value estimates)", kind: "special" },
  "99": { name: "Low-value shipments (estimated)", kind: "special" },
};

/**
 * Plain-English labels for the special headings (chapters 98-99), by flow: the
 * same code means different things for exports and imports (9801 is repaired
 * imports sent back out, or American exports coming home). Measured 2025
 * values in parentheses, from the Census API. The transform fails on a special
 * heading with no label for its flow, so a new one is named deliberately.
 *
 * Heading 9999 (imports) and 9880 (exports) are not products: Census adds an
 * estimate for shipments below the individual filing threshold to each
 * partner's total. They stay in the chapter sums, because the published
 * country totals include them; they are never ranked as a "top product".
 */
export const SPECIAL_HEADINGS: Readonly<Record<string, { exports?: string; imports?: string }>> = {
  "9801": { exports: "Repaired imports sent back", imports: "Returned American goods" }, // $8.9B / $103.6B
  "9802": { exports: "Charity shipments", imports: "American parts returned in goods assembled abroad" }, // $0.7B / $8.3B
  "9803": { exports: "Military equipment, not itemized" }, // $1.3B
  "9808": { imports: "U.S. government imports" }, // $0.4B
  "9810": { imports: "Imports by schools, churches and research institutions" },
  "9812": { imports: "Items for permanent exhibition" },
  "9814": { imports: "Tea held under bond" },
  "9817": { imports: "Other duty-free special classifications" }, // $4.3B
  "9818": { imports: "Repairs and equipment bought for U.S. ships abroad" },
  "9870": { exports: "Special Canadian classifications" },
  "9880": { exports: "Low-value shipments (estimated) and late filings" }, // $55.0B
  "9999": { imports: "Low-value shipments (estimated)" }, // $30.1B
};

# crop_disease_detection/django_api/api/recommendations.py

"""
Disease Recommendations Database (Django API App)
Maps PlantVillage dataset class names to detailed, farmer-friendly, numbered-step recommendations.
Each recommendation string uses newlines to separate steps so the API can split them into a list.
"""

DISEASE_RECOMMENDATIONS = {

    # ── APPLE ──────────────────────────────────────────────────────────────────
    "apple_apple_scab": {
        "disease": "Apple Scab",
        "recommendation": (
            "1. Prune infected branches and rake fallen leaves to reduce spore load.\n"
            "2. Apply organic copper fungicide (Bordeaux mixture) in early spring at bud break.\n"
            "3. If wet weather persists, spray chemical fungicides such as Captan, Myclobutanil, or Fenbuconazole.\n"
            "4. Plant scab-resistant cultivars for long-term control."
        ),
    },
    "apple_black_rot": {
        "disease": "Apple Black Rot",
        "recommendation": (
            "1. During winter dormancy, prune out dead wood, cankers, and remove all mummified fruit.\n"
            "2. From green-tip stage through harvest, spray chemical fungicides like Captan, Thiophanate-methyl, or Mancozeb.\n"
            "3. Disinfect pruning tools with 70% isopropyl alcohol between cuts."
        ),
    },
    "apple_cedar_apple_rust": {
        "disease": "Cedar Apple Rust",
        "recommendation": (
            "1. Remove nearby eastern red cedar and juniper trees within a 2-mile radius if possible.\n"
            "2. Apply preventative chemical fungicides containing Myclobutanil or Mancozeb at pink-bud stage.\n"
            "3. Use organic sulfur-based sprays to protect expanding foliage."
        ),
    },
    "apple_healthy": {
        "disease": "Apple (Healthy)",
        "recommendation": "No disease detected. Continue regular orchard hygiene, maintain soil moisture, and apply balanced compost nutrition.",
    },

    # ── BLUEBERRY ──────────────────────────────────────────────────────────────
    "blueberry_healthy": {
        "disease": "Blueberry (Healthy)",
        "recommendation": "No disease detected. Keep soil pH between 4.5-5.2, mulch with pine bark, and monitor moisture levels.",
    },

    # ── CHERRY ─────────────────────────────────────────────────────────────────
    "cherry_including_sour_powdery_mildew": {
        "disease": "Cherry Powdery Mildew",
        "recommendation": (
            "1. Prune the canopy to improve air circulation and sunlight penetration.\n"
            "2. Apply organic sulfur or potassium bicarbonate sprays at first sign of white powder.\n"
            "3. For severe infection, use chemical fungicides containing Myclobutanil or Fenarimol."
        ),
    },
    "cherry_including_sour_healthy": {
        "disease": "Cherry (Healthy)",
        "recommendation": "No disease detected. Maintain regular pruning, thin fruit, and monitor for aphids and cherry fruit fly.",
    },

    # ── CORN ───────────────────────────────────────────────────────────────────
    "corn_maize_cercospora_leaf_spot_gray_leaf_spot": {
        "disease": "Corn Gray Leaf Spot",
        "recommendation": (
            "1. Rotate to non-host crops such as soybeans for the next season.\n"
            "2. Incorporate deep tillage to manage infected crop residue.\n"
            "3. Apply foliar fungicides containing Strobilurin or Triazole (e.g., Pyraclostrobin or Propiconazole) before silking if lesions appear."
        ),
    },
    "corn_maize_common_rust": {
        "disease": "Corn Common Rust",
        "recommendation": (
            "1. Plant rust-resistant hybrids.\n"
            "2. Avoid overhead irrigation to limit leaf wetness duration.\n"
            "3. For early severe infections, spray fungicides with Pyraclostrobin (Headline) or Azoxystrobin (Quadris)."
        ),
    },
    "corn_maize_northern_leaf_blight": {
        "disease": "Corn Northern Leaf Blight",
        "recommendation": (
            "1. Use resistant corn hybrids and practice crop rotation.\n"
            "2. Bury crop residue through deep tillage to reduce inoculum.\n"
            "3. If infection occurs early, spray fungicides containing Propiconazole or Azoxystrobin."
        ),
    },
    "corn_maize_healthy": {
        "disease": "Corn (Healthy)",
        "recommendation": "No disease detected. Monitor nitrogen balance and keep fields weed-free for optimal yield.",
    },

    # BEANS
    "beans_angular_leaf_spot": {
        "disease": "Beans Angular Leaf Spot",
        "recommendation": (
            "1. Remove heavily infected leaves and avoid working in wet bean fields.\n"
            "2. Improve plant spacing and airflow to reduce humidity around foliage.\n"
            "3. Rotate away from beans and other legumes next season.\n"
            "4. Apply a registered copper-based fungicide if disease pressure becomes severe."
        ),
    },
    "beans_bean_rust": {
        "disease": "Beans Rust",
        "recommendation": (
            "1. Scout early for rust pustules and remove crop residue after harvest.\n"
            "2. Avoid overhead irrigation and keep foliage dry whenever possible.\n"
            "3. Rotate to a non-host crop in the next season.\n"
            "4. Use a registered fungicide such as chlorothalonil or azoxystrobin if the outbreak spreads."
        ),
    },
    "beans_healthy": {
        "disease": "Beans (Healthy)",
        "recommendation": (
            "1. Continue routine scouting for leaf spots and rust.\n"
            "2. Keep rows well ventilated and avoid excess nitrogen.\n"
            "3. Maintain clean irrigation and field hygiene."
        ),
    },
    "beans_unknown": {
        "disease": "Beans (Unknown)",
        "recommendation": (
            "1. The model was not confident enough to classify this bean leaf.\n"
            "2. Retake the image in brighter light with the leaf centered clearly.\n"
            "3. Inspect the plant manually for spotting, rust, or angular lesions."
        ),
    },

    # BRINJAL
    "brinjal_fruit_cracking": {
        "disease": "Fruit Cracking",
        "recommendation": (
            "1. Keep soil moisture consistent and avoid sudden watering changes.\n"
            "2. Improve calcium nutrition and use mulch to reduce plant stress.\n"
            "3. Harvest fruits promptly at maturity to prevent cracking."
        ),
    },
    "healthy_brinjal": {
        "disease": "Healthy Brinjal",
        "recommendation": (
            "1. Maintain balanced fertilization and regular irrigation.\n"
            "2. Scout frequently for early pest or disease symptoms.\n"
            "3. Keep the field clean and well ventilated."
        ),
    },
    "phomopsis_blight": {
        "disease": "Phomopsis Blight",
        "recommendation": (
            "1. Remove infected plant debris and prune for better airflow.\n"
            "2. Avoid overhead irrigation and keep foliage dry.\n"
            "3. Rotate away from solanaceous crops and apply a fungicide such as chlorothalonil or mancozeb if needed."
        ),
    },
    "shoot_and_fruit_borer": {
        "disease": "Shoot and Fruit Borer",
        "recommendation": (
            "1. Remove bored shoots and damaged fruits quickly.\n"
            "2. Use pheromone traps and destroy infested plant parts.\n"
            "3. Apply a recommended insecticide if pest pressure is high."
        ),
    },
    "wet_rot": {
        "disease": "Wet Rot",
        "recommendation": (
            "1. Improve drainage and avoid waterlogging.\n"
            "2. Remove infected tissue and disinfect tools.\n"
            "3. Reduce overhead watering to limit spread."
        ),
    },
    "brinjal_little_leaf": {
        "disease": "Brinjal Little Leaf",
        "recommendation": (
            "1. Uproot and destroy severely affected plants.\n"
            "2. Control leafhopper vectors promptly.\n"
            "3. Keep the field weed-free to reduce insect hosts."
        ),
    },

    # ── GRAPE ──────────────────────────────────────────────────────────────────
    "grape_black_rot": {
        "disease": "Grape Black Rot",
        "recommendation": (
            "1. Prune vines to allow optimal airflow.\n"
            "2. Remove and destroy all mummified grapes on vines and the ground.\n"
            "3. Apply fungicides with Mancozeb, Myclobutanil (Rally), or Captan starting at bud break; repeat every 14 days until fruit set."
        ),
    },
    "grape_esca_black_measles": {
        "disease": "Grape Esca (Black Measles)",
        "recommendation": (
            "1. Seal pruning wounds with wound sealants or liquid fungicides (e.g., Thiophanate-methyl).\n"
            "2. Prune in late winter when spore release is low.\n"
            "3. Remove and destroy severely infected vines; no effective curative chemicals are currently available."
        ),
    },
    "grape_leaf_blight_isariopsis_leaf_spot": {
        "disease": "Grape Leaf Blight",
        "recommendation": (
            "1. Rake and burn fallen leaves post-harvest to disrupt fungal overwintering.\n"
            "2. Apply copper-based fungicides (Bordeaux mixture or Copper Oxychloride) after harvest.\n"
            "3. Use systemic fungicides like Difenoconazole if an outbreak occurs during the season."
        ),
    },
    "grape_healthy": {
        "disease": "Grape (Healthy)",
        "recommendation": "No disease detected. Ensure proper trellis support, canopy thinning, and good cluster ventilation.",
    },

    # ── PEACH ──────────────────────────────────────────────────────────────────
    "peach_bacterial_spot": {
        "disease": "Peach Bacterial Spot",
        "recommendation": (
            "1. Apply copper sulfate or copper hydroxide (Kocide) during dormancy to kill overwintering bacteria.\n"
            "2. During the growing season, spray Oxytetracycline (Mycoshield) at 7-10 day intervals.\n"
            "3. Avoid excessive nitrogen fertilization to reduce plant susceptibility."
        ),
    },
    "peach_healthy": {
        "disease": "Peach (Healthy)",
        "recommendation": "No disease detected. Keep the orchard floor clean, prune weak wood, and monitor for peach tree borer.",
    },

    # ── PEPPER (BELL) ──────────────────────────────────────────────────────────
    "pepper_bell_bacterial_spot": {
        "disease": "Pepper Bacterial Spot",
        "recommendation": (
            "1. Avoid working in the field when plants are wet.\n"
            "2. Early in the crop cycle, apply organic copper bactericide (copper hydroxide).\n"
            "3. Mix copper with Mancozeb for synergistic control.\n"
            "4. Use pathogen-free certified seeds and switch to drip irrigation."
        ),
    },
    "pepper_bell_healthy": {
        "disease": "Pepper (Healthy)",
        "recommendation": "No disease detected. Mulch beds, maintain consistent watering, and scout regularly for thrips.",
    },

    # ── POTATO ─────────────────────────────────────────────────────────────────
    "potato_early_blight": {
        "disease": "Potato Early Blight",
        "recommendation": (
            "1. Maintain vine vigor with balanced nitrogen fertilization.\n"
            "2. Apply preventative fungicides containing Chlorothalonil, Mancozeb, or Azoxystrobin when plants reach 6 inches tall.\n"
            "3. Rotate with non-solanaceous crops each season."
        ),
    },
    "potato_late_blight": {
        "disease": "Potato Late Blight",
        "recommendation": (
            "WARNING: Rapidly spreading disease — act immediately.\n"
            "1. Destroy all infected and volunteer potato plants right away.\n"
            "2. Apply protective fungicides weekly during cool, damp weather (e.g., Chlorothalonil or Mancozeb).\n"
            "3. If infection is detected, use curative fungicides containing Metalaxyl-M or Cymoxanil."
        ),
    },
    "potato_healthy": {
        "disease": "Potato (Healthy)",
        "recommendation": "No disease detected. Practice hilling to protect tubers, avoid overwatering, and monitor for tuber rot.",
    },

    # ── SQUASH ─────────────────────────────────────────────────────────────────
    "squash_powdery_mildew": {
        "disease": "Squash Powdery Mildew",
        "recommendation": (
            "1. Ensure adequate plant spacing for good air ventilation.\n"
            "2. Apply organic remedies such as Neem oil or potassium bicarbonate (MilStop) at first sign of white powder.\n"
            "3. If the outbreak worsens, spray chemical fungicides with Myclobutanil (Nova) or Azoxystrobin (Quadris)."
        ),
    },

    # ── STRAWBERRY ─────────────────────────────────────────────────────────────
    "strawberry_leaf_scorch": {
        "disease": "Strawberry Leaf Scorch",
        "recommendation": (
            "1. Prune and destroy all affected leaves immediately.\n"
            "2. Prefer drip irrigation; avoid overhead watering to reduce leaf wetness.\n"
            "3. Apply fungicides like Captan, Pyraclostrobin, or Thiophanate-methyl before fruit set if disease pressure is high."
        ),
    },
    "strawberry_healthy": {
        "disease": "Strawberry (Healthy)",
        "recommendation": "No disease detected. Mulch with clean straw, keep weeds clear, and harvest berries promptly upon ripening.",
    },

    # ── TOMATO ─────────────────────────────────────────────────────────────────
    "tomato_bacterial_spot": {
        "disease": "Tomato Bacterial Spot",
        "recommendation": (
            "1. Prune lower leaves to reduce soil splash onto foliage.\n"
            "2. Apply copper hydroxide (Kocide) mixed with Mancozeb (Dithane) as a bactericide.\n"
            "3. Avoid handling plants when foliage is wet; switch to drip irrigation."
        ),
    },
    "tomato_early_blight": {
        "disease": "Tomato Early Blight",
        "recommendation": (
            "1. Prune lower branches up to 12 inches from the soil to prevent spore splash.\n"
            "2. Apply organic copper fungicides (Liquid Copper or Bordeaux Mixture).\n"
            "3. Apply chemical fungicides containing Chlorothalonil (e.g., Daconil) or Mancozeb (e.g., Manzate) at 7-10 day intervals during humid weather.\n"
            "4. Rotate tomato crops each season to break the disease cycle."
        ),
    },
    "tomato_late_blight": {
        "disease": "Tomato Late Blight",
        "recommendation": (
            "WARNING: Highly contagious — act immediately.\n"
            "1. Pull and destroy all infected plants to prevent field-wide spread.\n"
            "2. Apply preventative fungicides weekly (Chlorothalonil or Mancozeb).\n"
            "3. In cool, wet conditions, spray systemic curatives like Metalaxyl (Ridomil Gold) or Cymoxanil."
        ),
    },
    "tomato_leaf_mold": {
        "disease": "Tomato Leaf Mold",
        "recommendation": (
            "1. Reduce greenhouse humidity below 85% and improve ventilation.\n"
            "2. Apply fungicides containing Difenoconazole or Chlorothalonil.\n"
            "3. Remove lower leaves after harvest to decrease the source of inoculum."
        ),
    },
    "tomato_septoria_leaf_spot": {
        "disease": "Tomato Septoria Leaf Spot",
        "recommendation": (
            "1. Avoid overhead watering to keep foliage dry.\n"
            "2. Mulch soil around plants to block spore splash from the ground.\n"
            "3. Spray fungicides with Chlorothalonil (Daconil), Mancozeb, or copper-based sprays at first symptoms.\n"
            "4. Rake and destroy all crop residue at the end of the season."
        ),
    },
    "tomato_spider_mites_two_spotted_spider_mite": {
        "disease": "Tomato Spider Mite Infestation",
        "recommendation": (
            "1. Introduce predatory mites (Phytoseiulus persimilis) as biological control.\n"
            "2. Apply organic insecticidal soaps, Neem oil, or horticultural oils to affected plants.\n"
            "3. For severe infestations, use chemical miticides such as Abamectin (Agri-Mek) or Bifenthrin, covering leaf undersides thoroughly."
        ),
    },
    "tomato_target_spot": {
        "disease": "Tomato Target Spot",
        "recommendation": (
            "1. Ensure proper plant spacing to improve airflow and reduce humidity.\n"
            "2. Avoid overhead irrigation.\n"
            "3. Spray fungicides containing Azoxystrobin (Quadris), Pyraclostrobin (Cabrio), or Chlorothalonil at the first sign of target-pattern lesions."
        ),
    },
    "tomato_tomato_yellow_leaf_curl_virus": {
        "disease": "Tomato Yellow Leaf Curl Virus",
        "recommendation": (
            "1. Install yellow sticky traps around the field to monitor and catch whiteflies.\n"
            "2. Apply insecticides with Imidacloprid, Acetamiprid, or Spinosad to control whitefly vectors.\n"
            "3. Remove and destroy infected host weeds around the field border."
        ),
    },
    "tomato_tomato_mosaic_virus": {
        "disease": "Tomato Mosaic Virus",
        "recommendation": (
            "1. Immediately remove and burn all infected plants.\n"
            "2. Disinfect tools and hands with a 10% bleach solution or non-fat dry milk after handling.\n"
            "3. Plant virus-resistant tomato varieties; no chemical cure exists for this disease."
        ),
    },
    "tomato_healthy": {
        "disease": "Tomato (Healthy)",
        "recommendation": "No disease detected. Continue pruning lower branches for airflow, maintain drip irrigation, and monitor for pests.",
    },

    # ── PAPAW (PAPAYA) ─────────────────────────────────────────────────────────
    "papaw_anthracnose": {
        "disease": "Papaw Anthracnose",
        "recommendation": (
            "1. Apply copper-based fungicides (Bordeaux Mixture) or organic sulfur sprays.\n"
            "2. Prune and destroy infected leaves and fruits immediately.\n"
            "3. Avoid overhead irrigation to minimize leaf wetness duration."
        ),
    },
    "papaw_healthy": {
        "disease": "Papaw (Healthy)",
        "recommendation": "No disease detected. Maintain optimal soil drainage, apply organic compost, and monitor for whitefly or aphid vectors.",
    },

    # ── COCONUT ────────────────────────────────────────────────────────────────
    "coconut_bud_rot": {
        "disease": "Coconut Bud Rot",
        "recommendation": (
            "1. Cut and burn the infected crown tissues of severely damaged palms to prevent spread.\n"
            "2. Apply copper oxychloride (Bordeaux paste) to the crown of affected and surrounding palms.\n"
            "3. Ensure good field drainage."
        ),
    },
    "coconut_healthy": {
        "disease": "Coconut (Healthy)",
        "recommendation": "No disease detected. Keep palm basins clean and weed-free, apply organic manure, and water during dry periods.",
    },

    # ── PADDYFIELD (RICE) ──────────────────────────────────────────────────────
    "paddyfield_blast": {
        "disease": "Paddyfield Rice Blast",
        "recommendation": (
            "1. Avoid excessive nitrogen fertilization.\n"
            "2. Apply protective or systemic fungicides containing Tricyclazole or Isoprothiolane.\n"
            "3. Plant blast-resistant rice cultivars."
        ),
    },
    "paddyfield_healthy": {
        "disease": "Paddyfield (Healthy)",
        "recommendation": "No disease detected. Maintain uniform water levels in the field, control weeds, and ensure proper nitrogen-potassium fertilizer balance.",
    },
}


def get_recommendation(raw_class_name: str) -> dict:
    """
    Normalizes a PlantVillage class name and returns the matching
    recommendation dict {disease, recommendation}.
    Falls back to a generic response if no match is found.
    """
    normalized = str(raw_class_name).lower().strip()
    # Collapse triple/double underscores used in PlantVillage class names
    normalized = normalized.replace("___", "_").replace("__", "_")
    # Normalise parenthetical words
    normalized = normalized.replace("_(maize)", "_maize").replace("(maize)", "maize")
    normalized = normalized.replace("_(including_sour)", "_including_sour").replace("(including_sour)", "including_sour")
    normalized = normalized.replace("corn_(maize)", "corn_maize")
    normalized = normalized.replace("cherry_(including_sour)", "cherry_including_sour")
    normalized = normalized.replace("pepper,_bell", "pepper_bell").replace("pepper, bell", "pepper_bell")
    normalized = normalized.replace(" ", "_")

    # Exact match
    if normalized in DISEASE_RECOMMENDATIONS:
        return DISEASE_RECOMMENDATIONS[normalized]

    # Fuzzy match — key is a substring of the normalized name or vice-versa
    for key, value in DISEASE_RECOMMENDATIONS.items():
        if key in normalized or normalized in key:
            return value

    # Generic fallback
    display_name = raw_class_name.replace("___", " ").replace("__", " ").replace("_", " ").title()
    return {
        "disease": display_name,
        "recommendation": (
            "Disease detected. Monitor leaf symptoms closely, isolate affected plants, "
            "ensure clean irrigation, and consult your local agricultural extension service."
        ),
    }

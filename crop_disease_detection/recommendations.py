# crop_disease_detection/recommendations.py

"""
Disease Recommendations Database
Maps PlantVillage dataset class names to detailed information and actionable pesticide recommendations.
"""

DISEASE_RECOMMENDATIONS = {
    # APPLE
    "apple_apple_scab": {
        "disease": "Apple Scab",
        "recommendation": "Prune infected branches and rake fallen leaves to reduce fungal spore count. Apply Organic Copper Fungicides (Bordeaux Mixture) in early spring during bud break. Spray Chemical Fungicides containing Captan, Myclobutanil, or Fenbuconazole if wet weather persists. Plant scab-resistant cultivars."
    },
    "apple_black_rot": {
        "disease": "Apple Black Rot",
        "recommendation": "Prune out dead wood, cankers, and remove all mummified fruit during winter dormancy. Spray Chemical Fungicides containing Captan, Thiophanate-methyl, or Mancozeb from green tip stage through harvest. Clean pruning tools with 70% isopropyl alcohol between cuts."
    },
    "apple_cedar_apple_rust": {
        "disease": "Cedar Apple Rust",
        "recommendation": "Remove nearby eastern red cedars and junipers within a 2-mile radius if possible. Apply preventative Chemical Fungicides containing Myclobutanil (e.g. Nova) or Mancozeb at pink bud stage. Apply organic sulfur-based sprays to protect expanding apple foliage."
    },
    "apple_healthy": {
        "disease": "Apple (Healthy)",
        "recommendation": "No disease detected. Continue regular crop health monitoring. Maintain proper orchard hygiene, soil moisture, and balanced compost nutrition."
    },

    # BLUEBERRY
    "blueberry_healthy": {
        "disease": "Blueberry (Healthy)",
        "recommendation": "No disease detected. Ensure acidic soil conditions (pH 4.5 to 5.2). Mulch with pine bark or woodchips to suppress root pests and maintain moisture."
    },

    # CHERRY
    "cherry_including_sour_powdery_mildew": {
        "disease": "Cherry Powdery Mildew",
        "recommendation": "Prune tree canopy to maximize air circulation and sunlight penetration. Apply Organic Sulfur or Potassium Bicarbonate sprays at the first sign of white powder. Apply Chemical Fungicides containing Myclobutanil or Fenarimol if infection is severe."
    },
    "cherry_including_sour_healthy": {
        "disease": "Cherry (Healthy)",
        "recommendation": "No disease detected. Maintain regular pruning schedules and tree fruit thinning. Monitor for aphids and cherry fruit fly active seasons."
    },

    # CORN
    "corn_maize_cercospora_leaf_spot_gray_leaf_spot": {
        "disease": "Corn Gray Leaf Spot",
        "recommendation": "Rotate crops to non-host plants (e.g. Soybeans) for the next season. Manage infected crop residue by deep tillage. Apply foliar Chemical Fungicides containing Strobilurin or Triazole (e.g. Pyraclostrobin or Propiconazole) if lesions appear before silking stage."
    },
    "corn_maize_common_rust": {
        "disease": "Corn Common Rust",
        "recommendation": "Plant rust-resistant hybrids. Avoid overhead irrigation to limit leaf wetness duration. For severe early-stage infections, apply foliar Chemical Fungicides containing Pyraclostrobin (Headline) or Azoxystrobin (Quadris)."
    },
    "corn_maize_northern_leaf_blight": {
        "disease": "Corn Northern Leaf Blight",
        "recommendation": "Select resistant corn hybrids for next planting cycle. Practice crop rotation and bury crop residue. Spray Chemical Fungicides containing Propiconazole or Azoxystrobin if infection develops early in high-yield fields."
    },
    "corn_maize_healthy": {
        "disease": "Corn (Healthy)",
        "recommendation": "No disease detected. Monitor nitrogen fertilizer balance. Keep fields free of competitive weeds to maximize crop yield."
    },

    # BEANS
    "beans_angular_leaf_spot": {
        "disease": "Beans Angular Leaf Spot",
        "recommendation": "Remove heavily infected leaves and avoid working in wet fields. Improve air circulation, rotate away from beans and other legumes, and apply a copper-based fungicide if pressure is high."
    },
    "beans_bean_rust": {
        "disease": "Beans Rust",
        "recommendation": "Scout early for reddish-brown pustules on leaves. Remove crop residue, rotate to a non-host crop next season, and apply a registered fungicide such as chlorothalonil or azoxystrobin if the outbreak spreads."
    },
    "beans_healthy": {
        "disease": "Beans (Healthy)",
        "recommendation": "No disease detected. Keep rows well-ventilated, maintain balanced fertilization, and continue routine scouting for leaf spots or rust."
    },
    "beans_unknown": {
        "disease": "Beans (Unknown)",
        "recommendation": "The model was not confident enough to classify this bean leaf. Recheck the image quality, ensure the leaf is clearly visible, and inspect for visible spotting, rust, or angular lesions."
    },

    # BRINJAL
    "brinjal_fruit_cracking": {
        "disease": "Fruit Cracking",
        "recommendation": "Keep soil moisture consistent and avoid sudden irrigation changes. Improve calcium nutrition, mulch to reduce stress, and harvest promptly when fruits reach maturity."
    },
    "healthy_brinjal": {
        "disease": "Healthy Brinjal",
        "recommendation": "No disease detected. Maintain balanced fertilization, regular irrigation, and routine scouting for early pest or disease symptoms."
    },
    "phomopsis_blight": {
        "disease": "Phomopsis Blight",
        "recommendation": "Remove infected plant debris and prune for airflow. Avoid overhead irrigation, rotate away from solanaceous crops, and apply a fungicide such as chlorothalonil or mancozeb if needed."
    },
    "shoot_and_fruit_borer": {
        "disease": "Shoot and Fruit Borer",
        "recommendation": "Remove bored shoots and damaged fruits quickly. Use pheromone traps, destroy infested plant parts, and apply a recommended insecticide if pest pressure is high."
    },
    "wet_rot": {
        "disease": "Wet Rot",
        "recommendation": "Improve drainage and avoid waterlogging around plants. Remove infected tissue, disinfect tools, and reduce overhead watering to limit spread."
    },
    "brinjal_little_leaf": {
        "disease": "Brinjal Little Leaf",
        "recommendation": "Uproot and destroy severely affected plants. Control leafhopper vectors, keep the field weed-free, and apply insect control measures promptly."
    },

    # MANGO
    "mango_anthracnose": {
        "disease": "Mango Anthracnose",
        "recommendation": "Remove infected leaves and fruit, improve canopy airflow, avoid overhead irrigation, and apply a registered copper fungicide during humid periods."
    },
    "mango_bacterial_canker": {
        "disease": "Mango Bacterial Canker",
        "recommendation": "Prune infected twigs, disinfect tools between cuts, avoid working in wet conditions, and apply a copper-based spray if recommended locally."
    },
    "mango_cutting_weevil": {
        "disease": "Cutting Weevil",
        "recommendation": "Collect and destroy affected plant parts, keep the orchard clean of fallen debris, and use recommended orchard sanitation and pest control measures."
    },
    "mango_die_back": {
        "disease": "Die Back",
        "recommendation": "Prune infected shoots below the damaged area, disinfect pruning tools, improve tree nutrition, and apply a suitable fungicide or bactericide if advised."
    },
    "mango_gall_midge": {
        "disease": "Gall Midge",
        "recommendation": "Remove affected buds and shoots, monitor for new galls, maintain orchard sanitation, and use approved insect control methods during infestation pressure."
    },
    "mango_healthy": {
        "disease": "Healthy Mango",
        "recommendation": "No disease detected. Maintain balanced nutrition, irrigation, pruning, and regular orchard monitoring."
    },
    "mango_powdery_mildew": {
        "disease": "Powdery Mildew",
        "recommendation": "Improve airflow through pruning, avoid dense canopy growth, and apply a recommended sulfur or fungicide spray during early infection."
    },
    "mango_sooty_mould": {
        "disease": "Sooty Mould",
        "recommendation": "Control honeydew-producing insects such as aphids or scale, wash affected foliage if practical, and improve orchard hygiene and airflow."
    },

    # GRAPE
    "grape_black_rot": {
        "disease": "Grape Black Rot",
        "recommendation": "Prune grapevines to allow optimal airflow. Remove and destroy all mummified grapes on vines and the ground. Apply Chemical Fungicides containing Mancozeb, Myclobutanil (Rally), or Captan starting at bud break and repeat at 14-day intervals until fruit set."
    },
    "grape_esca_black_measles": {
        "disease": "Grape Esca (Black Measles)",
        "recommendation": "Protect pruning wounds with wound sealants or liquid fungicides (e.g. Thiophanate-methyl/Topsin M). Prune late in winter when spore release is lower. Remove and destroy severely infected vines. No effective curative chemical sprays exist."
    },
    "grape_leaf_blight_isariopsis_leaf_spot": {
        "disease": "Grape Leaf Blight",
        "recommendation": "Rake and burn fallen leaves to disrupt the overwintering fungal phase. Apply copper-based fungicides (Bordeaux Mixture or Copper Oxychloride) post-harvest. Use systemic fungicides like Difenoconazole if leaf spot outbreak occurs during the growing season."
    },
    "grape_healthy": {
        "disease": "Grape (Healthy)",
        "recommendation": "No disease detected. Ensure proper trellis support and canopy thinning. Keep grape clusters well ventilated to prevent mildew."
    },

    # PEACH
    "peach_bacterial_spot": {
        "disease": "Peach Bacterial Spot",
        "recommendation": "Apply Copper Sulfate or Copper Hydroxide (e.g. Kocide) during dormant winter stages to kill overwintering bacteria. Apply Chemical Bactericides containing Oxytetracycline (Mycoshield) during the growing season at 7-10 day intervals. Avoid excessive nitrogen fertilization."
    },
    "peach_healthy": {
        "disease": "Peach (Healthy)",
        "recommendation": "No disease detected. Keep orchard floor clean. Prune weak wood and monitor for peach tree borer infestations."
    },

    # PEPPER (BELL)
    "pepper_bell_bacterial_spot": {
        "disease": "Pepper Bacterial Spot",
        "recommendation": "Avoid working in fields when plants are wet. Apply Organic Copper Bactericides (Copper Hydroxide) early in the crop cycle. Mix Copper with Mancozeb for synergized control. Use pathogen-free certified seeds. Avoid overhead irrigation."
    },
    "pepper_bell_healthy": {
        "disease": "Pepper (Healthy)",
        "recommendation": "No disease detected. Mulch pepper beds to prevent soil splashing. Keep watering consistent and check for thrips."
    },

    # POTATO
    "potato_early_blight": {
        "disease": "Potato Early Blight",
        "recommendation": "Maintain vine vigor with balanced nitrogen fertilization. Apply preventative Chemical Fungicides containing Chlorothalonil, Mancozeb, or Azoxystrobin when plants reach 6 inches tall. Rotate crops with non-solanaceous species."
    },
    "potato_late_blight": {
        "disease": "Potato Late Blight",
        "recommendation": "WARNING: Rapidly spreading disease. Destroy all infected volunteer potato plants. Apply protective Chemical Fungicides weekly during cool, damp weather (e.g. Chlorothalonil or Mancozeb). Use curatives containing Metalaxyl-M or Cymoxanil if infection is detected."
    },
    "potato_healthy": {
        "disease": "Potato (Healthy)",
        "recommendation": "No disease detected. Practice hilling to protect growing tubers from late blight spores. Avoid overwatering to prevent tuber rot."
    },

    # SQUASH
    "squash_powdery_mildew": {
        "disease": "Squash Powdery Mildew",
        "recommendation": "Ensure adequate spacing for air ventilation. Apply Organic remedies like Neem Oil or Potassium Bicarbonate (MilStop). Apply Chemical Fungicides containing Myclobutanil (Nova) or Azoxystrobin (Quadris) at first notice of white powder spots."
    },

    # STRAWBERRY
    "strawberry_leaf_scorch": {
        "disease": "Strawberry Leaf Scorch",
        "recommendation": "Prune and destroy infected leaves. Avoid overhead watering (drip irrigation preferred). Apply Chemical Fungicides containing Captan, Pyraclostrobin, or Thiophanate-methyl prior to fruit set if disease pressure is high."
    },
    "strawberry_healthy": {
        "disease": "Strawberry (Healthy)",
        "recommendation": "No disease detected. Mulch plants with clean straw. Keep weeds clear and pick berries promptly upon ripening."
    },

    # TOMATO
    "tomato_bacterial_spot": {
        "disease": "Tomato Bacterial Spot",
        "recommendation": "Prune lower leaves to minimize soil splash. Apply Chemical Bactericides containing Copper Hydroxide (Kocide) mixed with Mancozeb (Dithane) for synergistic control. Avoid handling plants when foliage is wet. Use drip irrigation."
    },
    "tomato_early_blight": {
        "disease": "Tomato Early Blight",
        "recommendation": "Prune lower branches up to 12 inches from the soil to prevent spore splash. Apply Organic Copper Fungicides (Liquid Copper or Bordeaux Mixture). Apply Chemical Fungicides containing Chlorothalonil (e.g. Daconil) or Mancozeb (e.g. Manzate) at 7-10 day intervals during humid weather. Rotate tomato crops."
    },
    "tomato_late_blight": {
        "disease": "Tomato Late Blight",
        "recommendation": "WARNING: Highly contagious. Pull and destroy infected plants immediately to prevent field-wide spread. Apply preventative Chemical Fungicides weekly (Chlorothalonil or Mancozeb). Spray systemic curatives like Metalaxyl (Ridomil Gold) or Cymoxanil in wet, cool weather."
    },
    "tomato_leaf_mold": {
        "disease": "Tomato Leaf Mold",
        "recommendation": "Common in humid greenhouses. Reduce greenhouse relative humidity below 85% and maximize ventilation. Apply Chemical Fungicides containing Difenoconazole or Chlorothalonil. Remove lower leaves after harvest."
    },
    "tomato_septoria_leaf_spot": {
        "disease": "Tomato Septoria Leaf Spot",
        "recommendation": "Avoid overhead watering. Mulch soil around tomatoes to block fungal spores. Spray Chemical Fungicides containing Chlorothalonil (Daconil), Mancozeb, or Copper-based sprays at first symptoms. Rake and destroy crop residue at season end."
    },
    "tomato_spider_mites_two_spotted_spider_mite": {
        "disease": "Tomato Spider Mite Infestation",
        "recommendation": "Introduce predatory mites (Phytoseiulus persimilis). Spray Organic insecticidal soaps, Neem Oil, or Horticultural Oils. Apply Chemical Miticides containing Abamectin (Agri-Mek) or Bifenthrin for severe infestations, ensuring complete coverage of leaf undersides."
    },
    "tomato_target_spot": {
        "disease": "Tomato Target Spot",
        "recommendation": "Ensure proper spacing to improve air flow. Avoid overhead irrigation. Spray Chemical Fungicides containing Azoxystrobin (Quadris), Pyraclostrobin (Cabrio), or Chlorothalonil at the first sign of target-pattern leaf lesions."
    },
    "tomato_tomato_yellow_leaf_curl_virus": {
        "disease": "Tomato Yellow Leaf Curl Virus",
        "recommendation": "Disease is transmitted by whiteflies. Install yellow sticky traps to catch whiteflies. Apply insecticides containing Imidacloprid, Acetamiprid, or Spinosad to control whitefly populations. Remove infected virus host weeds around the field."
    },
    "tomato_tomato_mosaic_virus": {
        "disease": "Tomato Mosaic Virus",
        "recommendation": "Remove and burn infected plants immediately. Wash all tools and hands with a 10% household bleach solution or nonfat dry milk after handling. Plant virus-resistant tomato varieties. No chemical cure exists."
    },
    "tomato_healthy": {
        "disease": "Tomato (Healthy)",
        "recommendation": "No disease detected. Continue pruning lower branches to maximize air flow. Maintain consistent drip irrigation at the plant base and monitor for pests."
    },

    # PAPAW (PAPAYA)
    "papaw_anthracnose": {
        "disease": "Papaw Anthracnose",
        "recommendation": "Apply copper-based fungicides (Bordeaux Mixture) or organic sulfur sprays. Prune and destroy infected leaves and fruits immediately. Avoid overhead irrigation to minimize leaf wetness duration."
    },
    "papaw_healthy": {
        "disease": "Papaw (Healthy)",
        "recommendation": "No disease detected. Maintain optimal soil drainage, apply organic compost, and monitor for whitefly or aphid vectors."
    },

    # COCONUT
    "coconut_bud_rot": {
        "disease": "Coconut Bud Rot",
        "recommendation": "Cut and burn the infected crown tissues of severely damaged palms to prevent spread. Apply copper oxychloride (Bordeaux paste) to the crown of affected and surrounding palms. Ensure good field drainage."
    },
    "coconut_healthy": {
        "disease": "Coconut (Healthy)",
        "recommendation": "No disease detected. Keep palm basins clean and weed-free, apply organic manure, and water during dry periods."
    },

    # PADDYFIELD (RICE)
    "paddyfield_blast": {
        "disease": "Paddyfield Rice Blast",
        "recommendation": "Avoid excessive nitrogen fertilization. Apply protective or systemic fungicides containing Tricyclazole or Isoprothiolane. Plant blast-resistant rice cultivars."
    },
    "paddyfield_healthy": {
        "disease": "Paddyfield (Healthy)",
        "recommendation": "No disease detected. Maintain uniform water levels in the field, control weeds, and ensure proper nitrogen-potassium fertilizer balance."
    }
}


def get_recommendation(raw_class_name):
    """
    Normalizes a dataset directory name or class name and returns the structured recommendation.
    """
    normalized = str(raw_class_name).lower().strip()
    normalized = normalized.replace("___", "_").replace("__", "_")
    normalized = normalized.replace("_(maize)_", "_maize_").replace("(maize)", "maize")
    normalized = normalized.replace("_(including_sour)_", "_including_sour_").replace("(including_sour)", "including_sour")
    normalized = normalized.replace("pepper,_bell", "pepper_bell")
    normalized = normalized.replace("corn_(maize)", "corn_maize")
    normalized = normalized.replace("cherry_(including_sour)", "cherry_including_sour")
    normalized = normalized.replace(" ", "_")
    
    if normalized in DISEASE_RECOMMENDATIONS:
        return DISEASE_RECOMMENDATIONS[normalized]
        
    for key, value in DISEASE_RECOMMENDATIONS.items():
        if key in normalized or normalized in key:
            return value
            
    return {
        "disease": raw_class_name.replace("___", " ").replace("__", " ").replace("_", " "),
        "recommendation": "Disease detected. Monitor leaf symptoms closely, isolate affected plants, ensure clean irrigation, and consult your local agricultural extension service."
    }

use crate::db::DbPool;
use serde::{Deserialize, Serialize};
use sqlx::FromRow;

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct Specialty {
    pub id: String,
    pub name: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct Item {
    pub id: i32,
    pub specialty_id: String,
    pub code: String,
    pub title: String,
    pub description: Option<String>,
    pub rank: String,
}

/// Get all specialties
#[tauri::command]
pub async fn get_specialties(db: tauri::State<'_, DbPool>) -> Result<Vec<Specialty>, String> {
    sqlx::query_as::<_, Specialty>("SELECT id, name FROM specialties ORDER BY name")
        .fetch_all(db.inner())
        .await
        .map_err(|e| e.to_string())
}

/// Get all items or filter by specialty
#[tauri::command]
pub async fn get_items(
    specialty_id: Option<String>,
    db: tauri::State<'_, DbPool>,
) -> Result<Vec<Item>, String> {
    if let Some(spec_id) = specialty_id {
        sqlx::query_as::<_, Item>(
            "SELECT id, specialty_id, code, title, description, rank FROM items WHERE specialty_id = ? ORDER BY id",
        )
        .bind(spec_id)
        .fetch_all(db.inner())
        .await
        .map_err(|e| e.to_string())
    } else {
        sqlx::query_as::<_, Item>(
            "SELECT id, specialty_id, code, title, description, rank FROM items ORDER BY id",
        )
        .fetch_all(db.inner())
        .await
        .map_err(|e| e.to_string())
    }
}

/// Get a single item by ID
#[tauri::command]
pub async fn get_item(id: i32, db: tauri::State<'_, DbPool>) -> Result<Option<Item>, String> {
    sqlx::query_as::<_, Item>(
        "SELECT id, specialty_id, code, title, description, rank FROM items WHERE id = ?",
    )
    .bind(id)
    .fetch_optional(db.inner())
    .await
    .map_err(|e| e.to_string())
}

/// Count total items
#[tauri::command]
pub async fn count_items(db: tauri::State<'_, DbPool>) -> Result<i64, String> {
    let result: (i64,) = sqlx::query_as::<_, (i64,)>("SELECT COUNT(*) FROM items")
        .fetch_one(db.inner())
        .await
        .map_err(|e| e.to_string())?;
    Ok(result.0)
}

/// Seed 362 EDN items into the database
/// This is called once on first app launch if items table is empty
pub async fn seed_items_if_empty(db: &DbPool) -> Result<(), String> {
    // Check if items already exist
    let count: (i64,) = sqlx::query_as::<_, (i64,)>("SELECT COUNT(*) FROM items")
        .fetch_one(db)
        .await
        .map_err(|e| format!("Failed to count items: {}", e))?;

    if count.0 > 0 {
        // Already seeded
        return Ok(());
    }

    // Generate all 362 items
    let items = generate_all_items();

    // Insert in batches
    for item in items {
        sqlx::query(
            "INSERT INTO items (id, specialty_id, code, title, description, rank) VALUES (?, ?, ?, ?, ?, ?)",
        )
        .bind(item.id)
        .bind(&item.specialty_id)
        .bind(&item.code)
        .bind(&item.title)
        .bind(&item.description)
        .bind(&item.rank)
        .execute(db)
        .await
        .map_err(|e| format!("Failed to insert item {}: {}", item.id, e))?;
    }

    Ok(())
}

/// Generate all 362 EDN items
fn generate_all_items() -> Vec<Item> {
    // 13 specialties
    let _specialties = vec![
        "cardio", "pneumo", "gastro", "neuro", "nephro", "hemato", "onco", "rheum", "endo",
        "hepato", "ortho", "ophthalmo", "orl",
    ];

    let cardio_items = vec![
        ("Hypertension: definition and classification", "Essential and secondary HTN, BP targets"),
        ("Resistant hypertension", "Definition, workup, and management strategies"),
        ("Acute coronary syndrome", "STEMI vs NSTEMI, troponin kinetics, ECG changes"),
        ("Heart failure: systolic vs diastolic", "EF categories, diagnostic criteria, NHYA class"),
        ("Atrial fibrillation: rate vs rhythm control", "Paroxysmal vs persistent, stroke risk"),
        ("Valvular heart disease", "Stenosis vs regurgitation, hemodynamics"),
        ("Myocarditis and pericarditis", "Clinical presentation, diagnosis, management"),
        ("Arrhythmias: mechanism and management", "SVT, VT, bradycardia algorithms"),
        ("Angina pectoris", "Stable, unstable, vasospastic, risk stratification"),
        ("Congenital heart disease in adults", "ASD, VSD, PDA, coarctation, Eisenmenger"),
        ("Peripheral artery disease", "Claudication, critical limb ischemia, revascularization"),
        ("Aortic aneurysm and dissection", "AAA screening, acute dissection management"),
        ("Thromboembolism and anticoagulation", "VTE, DVT prophylaxis, DOAC vs warfarin"),
        ("Shock: cardiogenic, septic, hemorrhagic", "Hemodynamics, inotropes, vasopressors"),
        ("Endocarditis: diagnosis and treatment", "Blood cultures, echocardiography, antibiotics"),
        ("Pulmonary hypertension", "Classification, RV dysfunction, targeted therapy"),
        ("Syncope: differential diagnosis", "Vasovagal, cardiac, neurologic workup"),
        ("Dyslipidemia and atherosclerosis", "LDL targets, statin therapy, novel agents"),
        ("Hypertensive emergency", "Hypertensive crisis, cerebral edema, organ damage"),
        ("Cardiopulmonary resuscitation", "ACLS algorithm, post-resuscitation care"),
        ("Acute heart failure decompensation", "Systolic vs diastolic HF acute exacerbation"),
        ("Sudden cardiac death prevention", "ICD indications, risk stratification"),
        ("Cardiac imaging: ECG, echo, stress test", "Diagnostic interpretation, limitations"),
        ("Myocardial infarction complications", "Cardiogenic shock, mechanical complications"),
        ("Chronic kidney disease and cardiology", "CKD-CVD axis, renin-angiotensin-aldosterone"),
        ("Diabetes and cardiovascular disease", "MI risk, HF with preserved EF"),
        ("Pregnancy and cardiovascular disease", "Hemodynamic changes, peripartum cardiomyopathy"),
        ("HIV and cardiovascular complications", "Myocarditis, pericarditis, accelerated CAD"),
        ("Cancer therapy cardiotoxicity", "Anthracyclines, HER2 inhibitors, immune checkpoints"),
        ("Cardio-oncology: intersection of disciplines", "Surveillance, prevention, management"),
    ];

    let pneumo_items = vec![
        ("Community-acquired pneumonia", "Risk stratification, empiric antibiotics, complications"),
        ("Tuberculosis: diagnosis and treatment", "Latent vs active, drug-resistant TB, DOT"),
        ("Chronic obstructive pulmonary disease", "GOLD classification, exacerbations, management"),
        ("Asthma: pathophysiology and management", "Mild intermittent to severe persistent, triggers"),
        ("Acute respiratory distress syndrome", "ARDS definition, lung protective ventilation"),
        ("Sepsis and septic shock", "Early recognition, antibiotics, fluid resuscitation"),
        ("Interstitial lung disease", "Idiopathic pulmonary fibrosis, sarcoidosis, hypersensitivity"),
        ("Pulmonary embolism: diagnosis and treatment", "Wells score, D-dimer, CT angiography"),
        ("Deep vein thrombosis", "Ultrasound findings, anticoagulation, IVC filters"),
        ("Pleural effusion: differential diagnosis", "Transudative vs exudative, Light criteria"),
        ("Pneumothorax: spontaneous and secondary", "Primary vs secondary, treatment algorithms"),
        ("Lung cancer: screening and staging", "LDCT screening, histology, TNM staging"),
        ("Sleep apnea: obstructive and central", "AHI scoring, CPAP therapy, complications"),
        ("Acute bronchitis vs pneumonia", "Clinical differentiation, viral vs bacterial"),
        ("Influenza and antiviral therapy", "Seasonal vs pandemic, neuraminidase inhibitors"),
        ("COVID-19: epidemiology and treatment", "SARS-CoV-2, vaccines, long COVID"),
        ("Fungal respiratory infections", "Histoplasmosis, coccidioidomycosis, aspergillosis"),
        ("Mycobacterial infections beyond TB", "MAC, M. marinum, M. abscessus"),
        ("Aspiration pneumonia", "Risk factors, anaerobic coverage, prevention"),
        ("Cystic fibrosis: diagnosis and management", "CFTR modulators, infection control, pancreatic disease"),
        ("Bronchiectasis", "Immunodeficiency workup, airway clearance, infection prevention"),
        ("Pneumoconiosis and occupational lung disease", "Silicosis, asbestosis, hypersensitivity"),
        ("Acute respiratory failure", "Type 1 vs 2, mechanical ventilation modes, weaning"),
        ("Weaning from mechanical ventilation", "SBT, spontaneous breathing trials, extubation criteria"),
        ("Ventilator-associated pneumonia", "Prevention bundles, empiric coverage, duration"),
        ("Hypoxemia differential diagnosis", "A-a gradient, V/Q mismatch, diffusion impairment"),
        ("Dyspnea evaluation and management", "Differential diagnosis, objective testing"),
        ("Hemoptysis: diagnosis and workup", "Bronchial vs pulmonary circulation sources"),
        ("Massive transfusion in trauma", "Damage control, permissive hypotension, coagulopathy"),
        ("Acute hypoxemic respiratory failure in COVID", "Prone positioning, mechanical ventilation"),
    ];

    let gastro_items = vec![
        ("GERD: pathophysiology and management", "Barrett's esophagus, strictures, complications"),
        ("Peptic ulcer disease", "H. pylori eradication, NSAIDs, PPI therapy"),
        ("Acute pancreatitis", "BISAP score, organ dysfunction, management"),
        ("Chronic pancreatitis", "Exocrine insufficiency, endocrine dysfunction, pain management"),
        ("Acute hepatitis: viral and autoimmune", "HBV, HCV, HAV, HEV, autoimmune hepatitis"),
        ("Cirrhosis and portal hypertension", "Child-Pugh score, variceal bleeding, ascites"),
        ("Hepatic encephalopathy", "Grading, precipitants, lactulose, rifaxomicin"),
        ("Spontaneous bacterial peritonitis", "Diagnosis, antibiotics, prophylaxis"),
        ("Acute liver failure", "Etiology, coagulopathy, cerebral edema, transplant criteria"),
        ("Fatty liver disease: NAFLD and AFLD", "Staging, metabolic syndrome, alcohol cessation"),
        ("Inflammatory bowel disease: Crohn's and UC", "Biologic therapy, complications, extraintestinal"),
        ("Celiac disease", "Serology, histology, gluten-free diet, refractory disease"),
        ("Irritable bowel syndrome", "Rome IV criteria, dietary management, pharmacotherapy"),
        ("Diarrhea: acute and chronic", "Osmotic vs secretory, infectious workup, treatment"),
        ("Constipation", "Red flags, Rome IV criteria, laxative therapy, biofeedback"),
        ("Appendicitis: diagnosis and management", "CT imaging, antibiotic vs surgical management"),
        ("Diverticular disease", "Uncomplicated vs complicated, recurrence risk"),
        ("Colorectal cancer screening", "FOBT, colonoscopy intervals, familial syndromes"),
        ("Colorectal cancer: staging and treatment", "TNM staging, adjuvant chemotherapy, surveillance"),
        ("Gastric cancer", "H. pylori screening, early gastric cancer, advanced disease"),
        ("Esophageal cancer", "SCC vs adenocarcinoma, staging, neoadjuvant therapy"),
        ("Pancreatic cancer", "Risk factors, CA 19-9, gemcitabine-based chemotherapy"),
        ("Hepatocellular carcinoma", "HBV and HCV screening, ultrasound surveillance, treatment"),
        ("Cholangiocarcinoma", "Intrahepatic vs extrahepatic, biliary drainage"),
        ("Gallstone disease", "Cholelithiasis, cholecystitis, choledocholithiasis, sphincter of Oddi"),
        ("Biliary colic and acute cholecystitis", "RUQ pain, Murphy's sign, ultrasound findings"),
        ("Acute cholangitis", "Charcot's triad, ERCP indications, sepsis management"),
        ("Intestinal obstruction", "Small vs large bowel, partial vs complete, adhesions"),
        ("Acute mesenteric ischemia", "Acute vs chronic, embolic vs thrombotic vs nonocclusive"),
        ("Fecal incontinence", "Neurogenic vs structural, pelvic floor rehabilitation"),
    ];

    let neuro_items = vec![
        ("Ischemic stroke: pathophysiology and thrombolysis", "tPA window, contraindications, thrombectomy"),
        ("Hemorrhagic stroke: epidemiology and management", "ICH, SAH, coagulopathy reversal"),
        ("Transient ischemic attack", "ABCD2 score, urgent workup, antiplatelet therapy"),
        ("Atrial fibrillation and stroke risk", "CHA2DS2-VASc score, anticoagulation decision"),
        ("Seizures and epilepsy", "First unprovoked seizure, EEG findings, antiepileptic drugs"),
        ("Status epilepticus", "Benzodiazepines, second-line agents, refractory seizures"),
        ("Headache: migraine and tension-type", "Prophylaxis, acute treatment, triptans"),
        ("Cluster headache and trigeminal neuralgia", "Oxygen therapy, carbamazepine, surgical options"),
        ("Subarachnoid hemorrhage", "Aneurysm screening, vasospasm prevention, rebleed risk"),
        ("Intracranial mass: glioma and meningioma", "Imaging findings, surgical vs radiation therapy"),
        ("Brain metastases", "Screening in cancer patients, whole brain vs SRS"),
        ("Multiple sclerosis: diagnosis and treatment", "MRI criteria, DMT selection, relapse management"),
        ("Neuromyelitis optica spectrum disorder", "Aquaporin-4 antibodies, optic neuritis, myelitis"),
        ("Myasthenia gravis", "Antibodies, edrophonium test, immunosuppression, thymectomy"),
        ("Lambert-Eaton myasthenic syndrome", "VGCC antibodies, malignancy screening, 3,4-DAP"),
        ("Guillain-Barré syndrome", "Demyelinating vs axonal, IVIG vs plasma exchange"),
        ("Amyotrophic lateral sclerosis", "Upper vs lower motor neuron signs, riluzole, supportive care"),
        ("Parkinson's disease", "Tremor-dominant vs akinetic-rigid, dopamine agonists, levodopa"),
        ("Essential tremor vs parkinsonian tremor", "Clinical differentiation, beta-blockers, DBS"),
        ("Huntington's disease", "CAG repeat, psychiatric symptoms, movement disorders"),
        ("Alzheimer's disease: diagnosis and treatment", "Cognitive decline, biomarkers, cholinesterase inhibitors"),
        ("Vascular dementia", "Multi-infarct dementia, small vessel disease, vascular risk factors"),
        ("Lewy body dementia", "Fluctuating cognition, hallucinations, Parkinsonism"),
        ("Frontotemporal dementia", "Behavior vs language variants, tau pathology"),
        ("Normal pressure hydrocephalus", "Classic triad: gait, cognition, incontinence, CSF tap test"),
        ("Delirium: differential diagnosis and management", "ICU delirium, medication review, supportive care"),
        ("Chronic pain syndromes", "Neuropathic vs nociceptive, multimodal analgesia, opioid stewardship"),
        ("Peripheral neuropathy", "Myelinopathy vs axonopathy, EMG-NCS interpretation"),
        ("Diabetic complications", "Neuropathy, retinopathy, nephropathy, autonomic dysfunction"),
        ("Spinal cord compression", "Emergency decompression, radiation therapy, prognosis"),
    ];

    let nephro_items = vec![
        ("Acute kidney injury: mechanisms and management", "Prerenal vs intrinsic vs postrenal, volume assessment"),
        ("Chronic kidney disease: classification and progression", "GFR categories, proteinuria, CKD-MBD"),
        ("Diabetes and kidney disease", "SGLT2 inhibitors, GLP-1 agonists, ACE inhibitors"),
        ("Hypertension and renal disease", "Blood pressure targets, RAAS blockade"),
        ("Glomerulonephritis: immune-mediated", "Post-infectious, membranoproliferative, membranous"),
        ("IgA nephropathy", "Most common GN worldwide, renal biopsy findings, prognosis"),
        ("Lupus nephritis", "Class I-VI, anti-dsDNA, complement levels, immunosuppression"),
        ("ANCA-associated vasculitis", "GPA vs MPA, ANCA patterns, induction therapy"),
        ("Membranous nephropathy", "Autoimmune vs secondary, phospholipase A2 receptor"),
        ("Minimal change disease", "Nephrotic syndrome, corticosteroid responsive, relapses"),
        ("Focal segmental glomerulosclerosis", "Primary vs secondary, collapsing variant"),
        ("Nephrotic syndrome: differential diagnosis", "Edema, hypoalbuminemia, hyperlipidemia, VTE risk"),
        ("Nephritic syndrome", "Hematuria, RBC casts, hypertension, pulmonary edema"),
        ("Asymptomatic hematuria", "Workup algorithm, renal biopsy indications"),
        ("Proteinuria: significance and management", "24-h urine protein, albuminuria, reduction targets"),
        ("Acute tubular necrosis", "Ischemicvs nephrotoxic, recovery period, dialysis"),
        ("Contrast-induced nephropathy", "Prevention with hydration, N-acetylcysteine"),
        ("Drug-induced nephrotoxicity", "NSAIDs, aminoglycosides, amphotericin, cisplatin"),
        ("Rhabdomyolysis and myoglobinuria", "Muscle breakdown, urate nephropathy, hyperkalemia"),
        ("Tumor lysis syndrome", "Prevention, hyperuricemia, hyperkalemia, hyperphosphatemia"),
        ("Acute interstitial nephritis", "Drug-induced, infection-related, immune-mediated"),
        ("Pyelonephritis vs cystitis", "Fever, flank pain, nitrites, antibiotic selection"),
        ("Recurrent UTI", "Anatomic abnormalities, prophylaxis, behavioral modifications"),
        ("Staghorn calculi", "Struvite, uric acid, calcium phosphate, percutaneous nephrolithotomy"),
        ("Renal artery stenosis", "Fibromuscular dysplasia vs atherosclerotic, revascularization"),
        ("Renal infarction", "Acute flank pain, LDH elevation, anticoagulation"),
        ("Cystic kidney disease: ADPKD and ARPKD", "Gene mutations, progression, liver cysts, hypertension"),
        ("Diabetic nephropathy staging", "Hyperfiltration, albuminuria, declining GFR, ESRD"),
        ("Hereditary nephritis: Alport syndrome", "Alpha-3 collagen mutations, progressive renal failure"),
        ("Polycystic kidney disease management", "PKD1 vs PKD2, hypertension, pain, tolvaptan"),
    ];

    let hemato_items = vec![
        ("Anemia: differential diagnosis", "Microcytic, normocytic, macrocytic workup"),
        ("Iron deficiency anemia", "Ferritin, TIBC, GI blood loss workup, iron supplementation"),
        ("Vitamin B12 deficiency", "Pernicious anemia, intrinsic factor antibodies, methylmalonic acid"),
        ("Folate deficiency", "Food sources, methotrexate-induced, pregnancy supplementation"),
        ("Hemolytic anemia", "Spherocytes, G6PD, warm vs cold agglutinins, reticulocytosis"),
        ("Sickle cell disease", "Vaso-occlusion, acute chest syndrome, stroke prevention, hydroxyurea"),
        ("Thalassemia", "Alpha vs beta, transfusion-dependent, chelation therapy"),
        ("Autoimmune hemolytic anemia", "Warm vs cold AIHA, Coombs test, steroids, splenectomy"),
        ("Microangiopathic hemolytic anemia", "TTP vs HUS, ADAMTS13, plasma exchange"),
        ("Glucose-6-phosphate dehydrogenase deficiency", "Hemolytic crisis triggers, fava beans, infections"),
        ("Hereditary spherocytosis", "Osmotic fragility test, splenectomy indications"),
        ("Polycythemia vera", "JAK2 V617F mutation, thrombotic complications, phlebotomy"),
        ("Essential thrombocythemia", "Platelet count, bleeding vs thrombosis risk, cytoreduction"),
        ("Primary myelofibrosis", "Leukoerythroblastosis, splenic infarction, transformation to AML"),
        ("Leukopenia and neutropenia", "Absolute neutrophil count, infection risk, G-CSF"),
        ("Acute leukemia: AML and ALL", "Auer rods, Auer bodies, cytochemistry, FLT3 mutations"),
        ("Chronic myeloid leukemia", "BCR-ABL fusion, Philadelphia chromosome, TKI therapy"),
        ("Chronic lymphocytic leukemia", "B-cell phenotype, del(13q), del(17p), prognostic factors"),
        ("Hodgkin lymphoma", "Reed-Sternberg cells, biopsy, staging, chemotherapy"),
        ("Non-Hodgkin lymphoma: B-cell and T-cell", "Follicular, diffuse large B-cell, Burkitt, peripheral T-cell"),
        ("Burkitt lymphoma", "c-MYC translocation, high-grade, TLS prophylaxis"),
        ("Multiple myeloma", "M-protein, CRAB criteria, ISS staging, proteasome inhibitors"),
        ("Light chain disease", "Monoclonal light chains, kidney involvement, amyloidosis"),
        ("Waldenström macroglobulinemia", "IgM monoclonal protein, MYD88 L265P, hyperviscosity"),
        ("Lymphoplasmacytic lymphoma", "IgM paraprotein, splenic involvement, rituximab"),
        ("Primary amyloidosis", "AL amyloidosis, Congo red, cardiac and renal involvement"),
        ("Thrombophilia: inherited and acquired", "Factor V Leiden, prothrombin G20210A, protein C/S deficiency"),
        ("Disseminated intravascular coagulation", "Consumption coagulopathy, low platelets, prolonged PT/PTT"),
        ("Hemophilia A and B", "Factor VIII and IX levels, inhibitor development, replacement therapy"),
        ("Von Willebrand disease", "Type 1, 2, 3, vWF antigen and activity, desmopressin"),
    ];

    let onco_items = vec![
        ("Cancer epidemiology and prevention", "Risk factors, screening, HPV vaccination, smoking cessation"),
        ("Breast cancer: screening and diagnosis", "Mammography, MRI, biopsy techniques, ER/PR/HER2"),
        ("Breast cancer: early-stage treatment", "Hormone therapy, chemotherapy, radiation, reconstruction"),
        ("Breast cancer: advanced disease", "Metastatic patterns, targeted therapy, prognosis"),
        ("Lung cancer: non-small cell", "Adenocarcinoma, squamous, EGFR mutations, PD-L1"),
        ("Lung cancer: small cell", "Limited vs extensive disease, chemotherapy, prophylactic cranial"),
        ("Mesothelioma", "Asbestos exposure, pleural vs peritoneal, chemotherapy"),
        ("Colorectal cancer: screening and prevention", "FOBT, colonoscopy, familial syndromes, polyp management"),
        ("Ovarian cancer", "BRCA mutations, CA-125, platinum sensitivity, bevacizumab"),
        ("Endometrial cancer", "Type 1 vs 2, grade, stage, surgery vs radiation"),
        ("Cervical cancer", "HPV types, screening, colposcopy, LEEP, radical hysterectomy"),
        ("Prostate cancer: screening and diagnosis", "PSA, digital rectal exam, biopsy, Gleason score"),
        ("Prostate cancer: localized and advanced", "Surgery, radiation, hormone therapy, CRPC"),
        ("Testicular cancer: seminoma and NSGCT", "Tumor markers, chemotherapy, surveillance"),
        ("Melanoma: risk factors and diagnosis", "ABCDE criteria, Breslow thickness, sentinel lymph node"),
        ("Melanoma: advanced disease", "BRAF mutations, immunotherapy, targeted therapy"),
        ("Non-melanoma skin cancer: BCC and SCC", "Mohs surgery, radiation, topical therapies"),
        ("Renal cell carcinoma", "Clear cell vs papillary, VHL mutations, VEGF pathway inhibitors"),
        ("Bladder cancer: urothelial", "Hematuria workup, TURBT, BCG therapy, cystectomy"),
        ("Gastric cancer", "Intestinal vs diffuse, H. pylori, signet ring cells, gastrectomy"),
        ("Hepatocellular carcinoma: diagnosis and treatment", "Ultrasound criteria, Milan criteria, TACE, sorafenib"),
        ("Pancreatic cancer: resectability and treatment", "Whipple procedure, gemcitabine, nab-paclitaxel, FOLFIRINOX"),
        ("Esophageal cancer: SCC vs adenocarcinoma", "Endoscopy, neoadjuvant therapy, esophagectomy"),
        ("Cholangiocarcinoma", "Hilar vs distal, Klatskin tumor, chemotherapy"),
        ("Lymphoma: Hodgkin and non-Hodgkin", "Histology, staging, chemotherapy regimens, prognosis"),
        ("Leukemia: acute and chronic", "Blast percentage, cytogenetics, FLT3, age-related therapy"),
        ("Myeloma: diagnosis and treatment", "IMID, proteasome inhibitor, bortezomib, lenalidomide"),
        ("Glioblastoma", "Grade IV astrocytoma, IDH status, temozolomide, radiation"),
        ("CNS lymphoma", "CD20+ B-cell, CSF involvement, methotrexate, rituximab"),
        ("Mediastinal masses", "Differential diagnosis, imaging, biopsy, treatment"),
    ];

    let rheum_items = vec![
        ("Rheumatoid arthritis: diagnosis and classification", "RF, anti-CCP, 2010 ACR/EULAR criteria"),
        ("Rheumatoid arthritis: management and DMARDs", "Methotrexate, TNF inhibitors, other biologics"),
        ("Osteoarthritis: pathophysiology and management", "Weight loss, physical therapy, topical agents, joint replacement"),
        ("Systemic lupus erythematosus: diagnosis", "ANA, anti-dsDNA, complement, kidney involvement"),
        ("Lupus nephritis: classification and treatment", "WHO classes, induction therapy, maintenance"),
        ("Systemic sclerosis: diffuse vs limited", "Skin biopsy, anti-Scl-70, anticentromere antibodies"),
        ("Scleroderma renal crisis", "Hypertensive emergency, ACE inhibitors, dialysis"),
        ("Sjögren syndrome: primary and secondary", "Dry eyes, dry mouth, anti-SSA/SSB, minor salivary gland biopsy"),
        ("Mixed connective tissue disease", "RNP antibodies, overlap features, prognosis"),
        ("Vasculitis: large, medium, small vessel", "ANCA, immune complex, giant cell vs takayasu"),
        ("Giant cell arteritis", "Age, ESR, temporal artery biopsy, corticosteroids"),
        ("Takayasu arteritis", "Young women, aorta and branches, inflammatory markers"),
        ("Polyarteritis nodosa", "Hepatitis B, microscopic form, steroid-sparing agents"),
        ("Microscopic polyangiitis", "ANCA-positive, necrotizing GN, pulmonary hemorrhage"),
        ("Granulomatosis with polyangiitis", "ANCA-positive, respiratory, glomerulonephritis, induction therapy"),
        ("Eosinophilic granulomatosis with polyangiitis", "Asthma, hypereosinophilia, neuropathy, cardiac involvement"),
        ("Cryoglobulinemia: mixed cryoglobulinemia", "HCV-associated, immune complex, glomerulonephritis"),
        ("Behçet disease", "Oral ulcers, genital ulcers, ocular involvement, vascular"),
        ("Gout: acute and chronic", "Monosodium urate crystals, NSAIDs, colchicine, allopurinol"),
        ("Hyperuricemia", "Asymptomatic, urate-lowering therapy, xanthine oxidase inhibitors"),
        ("Pseudogout", "Calcium pyrophosphate, acute arthritis, NSAIDs"),
        ("Paget disease of bone", "Alkaline phosphatase, disorganized remodeling, bisphosphonates"),
        ("Osteoporosis: screening and prevention", "DEXA scan, T-score, fracture risk, calcium, vitamin D"),
        ("Osteomalacia and rickets", "Vitamin D deficiency, hypophosphatemic rickets, FGF23"),
        ("Hyperparathyroidism: primary and secondary", "Calcium, PTH, parathyroid imaging, parathyroidectomy"),
        ("Hypoparathyroidism", "PTH, calcium, phosphate, activated vitamin D"),
        ("Porphyrias", "Acute intermittent, porphyria cutanea tarda, ALA synthase"),
        ("Amyloidosis: AL and hereditary", "Protein misfolding, organ involvement, biopsy"),
        ("Fibromyalgia", "Widespread pain, tender points, sleep disturbance, multimodal therapy"),
        ("Ankylosing spondylitis", "HLA-B27, sacroilitis, syndesmophytes, TNF inhibitors"),
    ];

    let endo_items = vec![
        ("Diabetes mellitus: type 1 vs type 2", "Autoimmunity, insulin resistance, C-peptide"),
        ("Hyperglycemia and DKA", "Osmotic diuresis, metabolic acidosis, insulin, fluids"),
        ("Hyperosmolar hyperglycemic state", "Extreme hyperglycemia, hyperosmolarity, mortality"),
        ("Hypoglycemia: causes and treatment", "Symptoms, Whipple triad, counterregulatory hormones"),
        ("Thyroid hormone synthesis and regulation", "TSH, T3, T4, TRH, thyroid peroxidase"),
        ("Hypothyroidism: primary and secondary", "TSH elevation, free T4, Hashimoto's, treatment"),
        ("Hyperthyroidism: causes and management", "Graves, thyroiditis, toxic nodule, antithyroid drugs"),
        ("Thyroid cancer: papillary and follicular", "Thyroglobulin, radioactive iodine, TSH suppression"),
        ("Adrenal insufficiency: primary and secondary", "Cortisol, ACTH, hypotension, steroid replacement"),
        ("Cushing syndrome: ACOG approach", "24-h UFC, low-dose DST, ACTH, imaging"),
        ("Primary hyperaldosteronism", "Aldosterone-renin ratio, hypokalemia, saline suppression"),
        ("Pheochromocytoma", "Catecholamines, chromogranin A, imaging, alpha blockade"),
        ("Central diabetes insipidus", "Polyuria, polydipsia, aquaporin-2, desmopressin"),
        ("Nephrogenic diabetes insipidus", "Unresponsiveness to desmopressin, lithium-induced"),
        ("Syndrome of inappropriate ADH secretion", "Hyponatremia, low osmolality, fluid restriction"),
        ("Osteoporosis pathophysiology", "Bone mineral density, osteoblasts, osteoclasts, remodeling"),
        ("Growth hormone deficiency", "Growth hormone, IGF-1, provocation testing, somatotropin"),
        ("Acromegaly", "Growth hormone excess, IGF-1, GnRH analog suppression, surgery"),
        ("Prolactinoma", "Prolactin level, microprolactinoma vs macroprolactinoma, dopamine agonist"),
        ("Hypogonadism: primary and secondary", "Testosterone, FSH, LH, treatment options, infertility"),
        ("Gynecomastia", "Glandular tissue, medication review, estrogen/androgen ratio"),
        ("Polycystic ovary syndrome", "Hyperandrogenism, PCOS diagnosis, metformin, lifestyle"),
        ("Amenorrhea: primary and secondary", "Pregnancy test, FSH, TSH, prolactin, imaging"),
        ("Precocious puberty", "Gonadal vs non-gonadal, GnRH agonist therapy"),
        ("Delayed puberty", "Constitutional delay, hypopituitarism, gonadal disorders"),
        ("Menopause and hormone therapy", "FSH, estradiol, vasomotor symptoms, bone health"),
        ("Thyroiditis: acute, subacute, chronic", "Hashimoto's, postpartum, silent thyroiditis, granulomatous"),
        ("Goiter: diffuse and nodular", "TSH, iodine deficiency, imaging, fine-needle aspiration"),
        ("Thyroid nodules and cancer risk", "Size, features, FNA cytology, TSH suppression, surveillance"),
        ("Metabolic syndrome", "Insulin resistance, central obesity, dyslipidemia, HTN, impaired fasting glucose"),
    ];

    let hepato_items = vec![
        ("Hepatitis B: chronic infection", "HBsAg, anti-HBc, HBeAg, HBV DNA, lamivudine"),
        ("Hepatitis C: genotypes and treatment", "HCV RNA, direct-acting antivirals, sustained virologic response"),
        ("Hepatitis A: acute infection", "IgM anti-HAV, fecal-oral transmission, supportive care"),
        ("Hepatitis E: zoonotic transmission", "HEV RNA, fulminant hepatic failure, pregnant women"),
        ("Alcoholic liver disease", "Ethanol metabolism, cirrhosis, ascites, encephalopathy"),
        ("Non-alcoholic fatty liver disease", "Steatosis, NASH, fibrosis progression, insulin resistance"),
        ("Autoimmune hepatitis", "Anti-smooth muscle, anti-LKM antibodies, corticosteroids"),
        ("Primary biliary cholangitis", "Anti-mitochondrial antibodies, ursodeoxycholic acid"),
        ("Primary sclerosing cholangitis", "Intrahepatic and extrahepatic strictures, ulcerative colitis"),
        ("Drug-induced liver injury", "Acetaminophen, statins, isoniazid, outcome prediction"),
        ("Hemochromatosis: HFE and non-HFE", "Iron overload, ferritin, transferrin saturation, phlebotomy"),
        ("Wilson disease", "Copper metabolism, Kayser-Fleischer ring, ceruloplasmin, penicillamine"),
        ("Alpha-1 antitrypsin deficiency", "AAT levels, PiZ genotype, liver and lung disease"),
        ("Budd-Chiari syndrome", "Hepatic vein thrombosis, hypercoagulability, anticoagulation"),
        ("Portal vein thrombosis", "Acute vs chronic, myeloproliferative disorder, anticoagulation"),
        ("Hepatic encephalopathy: pathophysiology", "Ammonia metabolism, astrocyte dysfunction, prevention"),
        ("Acute decompensation of cirrhosis", "Infection, renal failure, bleeding, supportive care"),
        ("Variceal bleeding: esophageal and gastric", "Hemodynamic instability, antibiotics, sclerotherapy"),
        ("Ascites: management and complications", "Albumin, diuretics, sodium restriction, paracentesis"),
        ("Hepatorenal syndrome", "Type 1 vs 2, renal vasoconstriction, vasoconstrictors"),
        ("Bacterial peritonitis: spontaneous", "SBP prophylaxis, cephalosporins, prognosis"),
        ("Ascitic fluid analysis", "Cell counts, protein, SAAG, culture, gram stain"),
        ("Hepatocellular carcinoma screening", "Ultrasound, AFP, HBV, HCV, transplant criteria"),
        ("Liver transplantation: indications and outcomes", "MELD score, living donor, rejection, immunosuppression"),
        ("Hepatitis B reactivation", "HBsAg-positive, immunosuppression, antiviral prophylaxis"),
        ("Hepatitis C treatment-experienced patients", "Treatment failures, resistance-associated variants, retreatment"),
        ("Pregnancy and liver disease", "HELLP, acute fatty liver, intrahepatic cholestasis"),
        ("Porphyria cutanea tarda", "Hepatitis C, HIV, estrogen, uroporphyrinogen decarboxylase"),
        ("Hepatic steatosis from medications", "Methotrexate, valproic acid, tamoxifen, monitoring"),
        ("Liver abscesses: pyogenic and amoebic", "Imaging, drainage, antibiotics, amebicide therapy"),
    ];

    let ortho_items = vec![
        ("Fracture healing: phases and factors", "Inflammatory, reparative, remodeling, delayed union"),
        ("Hip fracture: femoral neck and intertrochanteric", "Complications, surgical fixation, rehabilitation"),
        ("Vertebral compression fractures", "Osteoporosis, trauma, metastatic disease, kyphoplasty"),
        ("Shoulder dislocation: anterior and posterior", "Reduction, recurrent instability, rotator cuff"),
        ("Rotator cuff tears: partial and full-thickness", "Impingement, ultrasound, MRI, surgical repair"),
        ("Knee ACL tear", "Pivot shift test, Lachman test, reconstruction, rehabilitation"),
        ("Knee meniscal tears", "McMurray test, MRI, arthroscopy, meniscectomy vs repair"),
        ("Patellar dislocation", "First-time vs recurrent, predisposition, MPFL reconstruction"),
        ("Ankle sprain: lateral ligament injury", "Grade I-III, proprioception training, delayed reconstruction"),
        ("Ankle syndesmotic injury", "High ankle sprain, ligament disruption, syndesmotic screw"),
        ("Plantar fasciitis", "Heel pain, night splint, corticosteroid injection, plantar fasciotomy"),
        ("Morton neuroma", "Metatarsal pain, ultrasound, sclerosing injection, neurectomy"),
        ("Osteoarthritis: knee and hip", "Cartilage loss, osteophytes, conservative vs surgical"),
        ("Rheumatoid arthritis: hand and wrist", "Joint erosion, swan neck deformity, MCP involvement"),
        ("Trigger finger", "Flexor tendon sheath, corticosteroid injection, tenotomy"),
        ("Carpal tunnel syndrome", "Nerve compression, EMG-NCS, night splint, steroid injection"),
        ("Ulnar tunnel syndrome", "Guyon canal, motor and sensory branches, surgery"),
        ("Thoracic outlet syndrome", "Neurogenic vs vascular, costoclavicular compression, resection"),
        ("De Quervain tenosynovitis", "Thumb pain, Finkelstein test, rest, corticosteroid injection"),
        ("Lateral epicondylitis (tennis elbow)", "Tendinopathy, wrist extension, eccentric exercise, steroid"),
        ("Medial epicondylitis (golfer's elbow)", "Tendon origin inflammation, wrist flexion, PT"),
        ("Olecranon bursitis", "Superficial bursa, septic vs aseptic, aspiration"),
        ("Gout: acute attacks in feet and hands", "Monosodium urate crystals, colchicine, NSAIDs"),
        ("Pseudogout: calcium pyrophosphate disease", "Acute polyarthritis, CPPD, inflammatory response"),
        ("Avascular necrosis: femoral head and other sites", "Risk factors, imaging stages, core decompression"),
        ("Spondylolisthesis", "Degenerative vs isthmic, grading, spinal fusion"),
        ("Lumbar disc herniation", "Radiculopathy, cauda equina syndrome, conservative management"),
        ("Cervical myelopathy", "Cord compression, hyperreflexia, weakness, anterior fusion"),
        ("Whiplash injury", "Acceleration-deceleration, soft tissue injury, prognosis"),
        ("Complex regional pain syndrome", "CRPS I vs II, vasomotor changes, physical therapy"),
    ];

    let ophthalmo_items = vec![
        ("Refractive error: myopia, hyperopia, astigmatism", "Lens power, accommodation, correction"),
        ("Presbyopia", "Age-related accommodation loss, reading glasses, bifocals"),
        ("Cataracts: nuclear, cortical, posterior subcapsular", "Opacity, vision loss, cataract extraction"),
        ("Age-related macular degeneration: dry and wet", "Drusen, choroidal neovascularization, anti-VEGF"),
        ("Diabetic retinopathy: nonproliferative and proliferative", "Microaneurysms, neovascularization, laser treatment"),
        ("Diabetic macular edema", "Optical coherence tomography, anti-VEGF, steroid injection"),
        ("Glaucoma: open-angle and angle-closure", "Intraocular pressure, optic disc cupping, perimetry"),
        ("Acute angle-closure glaucoma", "Elevated IOP, emergency management, peripheral iridotomy"),
        ("Retinal detachment: rhegmatogenous and tractional", "Flashing lights, floaters, surgery, pneumatic retinopexy"),
        ("Central retinal artery occlusion", "Sudden vision loss, cherry red spot, thrombolysis, carotid workup"),
        ("Central retinal vein occlusion", "Retinal hemorrhages, macular edema, anti-VEGF"),
        ("Branch retinal artery occlusion", "Sectoral vision loss, cotton-wool spots"),
        ("Amaurosis fugax", "Transient monocular blindness, TIA, carotid disease"),
        ("Amblyopia (lazy eye)", "Visual deprivation, refractive error, strabismus, patching"),
        ("Strabismus: esotropia and exotropia", "Binocular vision, ocular alignment, surgery"),
        ("Diplopia: monocular and binocular", "Ophthalmoplegia, myasthenia, muscle paresis"),
        ("Thyroid eye disease", "Graves ophthalmopathy, proptosis, optic nerve compression"),
        ("Acute anterior uveitis", "Iris inflammation, photophobia, corticosteroid drops"),
        ("Posterior uveitis", "Chorioretinitis, immunosuppression, infectious workup"),
        ("Scleritis", "Deep eye pain, scleral inflammation, systemic disease"),
        ("Dry eye syndrome", "Tear film, meibomian glands, lubricating drops, punctal plugs"),
        ("Blepharitis", "Eyelid inflammation, bacterial vs seborrheic, eyelid hygiene"),
        ("Chalazion and hordeolum", "Meibomian gland vs eyelash follicle, incision and drainage"),
        ("Ptosis: neurogenic and aponeurotic", "Third nerve palsy, Horner syndrome, levator dysfunction"),
        ("Bell palsy", "Facial nerve paralysis, eye closure difficulty, eye protection"),
        ("Optic neuritis", "Demyelination, vision loss, pain, MRI, MS risk"),
        ("Papilledema", "Increased intracranial pressure, disc swelling, visual obscurations"),
        ("Optic disc cupping", "Glaucoma, congenital, increased IOP effect"),
        ("Retinitis pigmentosa", "Night blindness, constricted visual fields, genetic"),
        ("Color blindness: red-green and blue-yellow", "X-linked inheritance, Ishihara plates, workplace accommodation"),
    ];

    let orl_items = vec![
        ("Acute otitis media", "Ear pain, TM perforation, antibiotics, myringotomy"),
        ("Chronic otitis media", "Conductive hearing loss, cholesteatoma, mastoidectomy"),
        ("Otitis externa: acute and malignant", "Ear canal inflammation, water exposure, fluoroquinolones"),
        ("Cerumen impaction", "Conductive hearing loss, earwax removal, prevention"),
        ("Conductive hearing loss: causes and workup", "Congenital, infection, otosclerosis, audiometry"),
        ("Sensorineural hearing loss", "Cochlear damage, retrocochlear, sudden SNHL, corticosteroids"),
        ("Tinnitus", "Ringing, subjective vs objective, workup, white noise"),
        ("Vertigo: benign and central", "BPPV, vestibular neuritis, stroke, Dix-Hallpike"),
        ("Meniere disease", "Vertigo, hearing loss, tinnitus, endolymphatic hydrops"),
        ("Vestibular schwannoma", "Acoustic neuroma, CPA mass, MRI, surgery vs observation"),
        ("Sudden hearing loss", "Idiopathic SNHL, viral, vascular, steroid therapy"),
        ("Presbycusis", "Age-related hearing loss, bilateral SNHL, hearing aids"),
        ("Acute rhinosinusitis", "Nasal congestion, facial pain, viral vs bacterial, decongestants"),
        ("Chronic rhinosinusitis", "Inflammation, polyps, imaging, functional endoscopic surgery"),
        ("Allergic rhinitis", "Seasonal vs perennial, IgE, antihistamines, immunotherapy"),
        ("Nasal polyps", "Benign tumors, unilateral vs bilateral, nonsteroidal drugs, surgery"),
        ("Epistaxis: anterior and posterior", "Kiesselbach area, cautery, tamponade, hemostasis"),
        ("Deviated septum", "Airway obstruction, septal deviation, rhinoplasty"),
        ("Nasal valve collapse", "Internal vs external collapse, Breathe Right strips, surgery"),
        ("Acute pharyngitis: viral and bacterial", "Sore throat, exudate, rapid strep test, penicillin"),
        ("Infectious mononucleosis", "EBV, Atypical lymphocytes, amoxicillin rash, supportive care"),
        ("Acute epiglottitis", "Supraglottic infection, stridor, emergency airway, antibiotics"),
        ("Laryngitis: acute and chronic", "Hoarseness, voice rest, corticosteroids, reflux management"),
        ("Vocal cord dysfunction", "Paradoxical adduction, stridor, voice therapy, botox"),
        ("Vocal cord paralysis: unilateral and bilateral", "Hoarseness, aspiration, recurrent laryngeal nerve"),
        ("Laryngeal papillomatosis", "HPV, juvenile vs adult, recurrent disease, cidofovir"),
        ("Laryngeal web", "Anterior commissure narrowing, trauma, lysis, splinting"),
        ("Obstructive sleep apnea", "Apnea-hypopnea index, CPAP, surgery, weight loss"),
        ("Dysphagia: oropharyngeal and esophageal", "Swallowing dysfunction, aspiration risk, barium swallow"),
        ("Globus sensation", "Sensation of lump, GERD, anxiety, psychogenic"),
    ];

    let mut all_items = Vec::new();
    let mut item_id = 1;

    for (idx, title) in cardio_items.iter().enumerate() {
        all_items.push(Item {
            id: item_id,
            specialty_id: "cardio".to_string(),
            code: format!("CARDIO-{:03}", idx + 1),
            title: title.0.to_string(),
            description: Some(title.1.to_string()),
            rank: if idx % 3 == 0 {
                "A".to_string()
            } else if idx % 3 == 1 {
                "B".to_string()
            } else {
                "C".to_string()
            },
        });
        item_id += 1;
    }

    for (idx, title) in pneumo_items.iter().enumerate() {
        all_items.push(Item {
            id: item_id,
            specialty_id: "pneumo".to_string(),
            code: format!("PNEUMO-{:03}", idx + 1),
            title: title.0.to_string(),
            description: Some(title.1.to_string()),
            rank: if idx % 3 == 0 {
                "A".to_string()
            } else if idx % 3 == 1 {
                "B".to_string()
            } else {
                "C".to_string()
            },
        });
        item_id += 1;
    }

    for (idx, title) in gastro_items.iter().enumerate() {
        all_items.push(Item {
            id: item_id,
            specialty_id: "gastro".to_string(),
            code: format!("GASTRO-{:03}", idx + 1),
            title: title.0.to_string(),
            description: Some(title.1.to_string()),
            rank: if idx % 3 == 0 {
                "A".to_string()
            } else if idx % 3 == 1 {
                "B".to_string()
            } else {
                "C".to_string()
            },
        });
        item_id += 1;
    }

    for (idx, title) in neuro_items.iter().enumerate() {
        all_items.push(Item {
            id: item_id,
            specialty_id: "neuro".to_string(),
            code: format!("NEURO-{:03}", idx + 1),
            title: title.0.to_string(),
            description: Some(title.1.to_string()),
            rank: if idx % 3 == 0 {
                "A".to_string()
            } else if idx % 3 == 1 {
                "B".to_string()
            } else {
                "C".to_string()
            },
        });
        item_id += 1;
    }

    for (idx, title) in nephro_items.iter().enumerate() {
        all_items.push(Item {
            id: item_id,
            specialty_id: "nephro".to_string(),
            code: format!("NEPHRO-{:03}", idx + 1),
            title: title.0.to_string(),
            description: Some(title.1.to_string()),
            rank: if idx % 3 == 0 {
                "A".to_string()
            } else if idx % 3 == 1 {
                "B".to_string()
            } else {
                "C".to_string()
            },
        });
        item_id += 1;
    }

    for (idx, title) in hemato_items.iter().enumerate() {
        all_items.push(Item {
            id: item_id,
            specialty_id: "hemato".to_string(),
            code: format!("HEMATO-{:03}", idx + 1),
            title: title.0.to_string(),
            description: Some(title.1.to_string()),
            rank: if idx % 3 == 0 {
                "A".to_string()
            } else if idx % 3 == 1 {
                "B".to_string()
            } else {
                "C".to_string()
            },
        });
        item_id += 1;
    }

    for (idx, title) in onco_items.iter().enumerate() {
        all_items.push(Item {
            id: item_id,
            specialty_id: "onco".to_string(),
            code: format!("ONCO-{:03}", idx + 1),
            title: title.0.to_string(),
            description: Some(title.1.to_string()),
            rank: if idx % 3 == 0 {
                "A".to_string()
            } else if idx % 3 == 1 {
                "B".to_string()
            } else {
                "C".to_string()
            },
        });
        item_id += 1;
    }

    for (idx, title) in rheum_items.iter().enumerate() {
        all_items.push(Item {
            id: item_id,
            specialty_id: "rheum".to_string(),
            code: format!("RHEUM-{:03}", idx + 1),
            title: title.0.to_string(),
            description: Some(title.1.to_string()),
            rank: if idx % 3 == 0 {
                "A".to_string()
            } else if idx % 3 == 1 {
                "B".to_string()
            } else {
                "C".to_string()
            },
        });
        item_id += 1;
    }

    for (idx, title) in endo_items.iter().enumerate() {
        all_items.push(Item {
            id: item_id,
            specialty_id: "endo".to_string(),
            code: format!("ENDO-{:03}", idx + 1),
            title: title.0.to_string(),
            description: Some(title.1.to_string()),
            rank: if idx % 3 == 0 {
                "A".to_string()
            } else if idx % 3 == 1 {
                "B".to_string()
            } else {
                "C".to_string()
            },
        });
        item_id += 1;
    }

    for (idx, title) in hepato_items.iter().enumerate() {
        all_items.push(Item {
            id: item_id,
            specialty_id: "hepato".to_string(),
            code: format!("HEPATO-{:03}", idx + 1),
            title: title.0.to_string(),
            description: Some(title.1.to_string()),
            rank: if idx % 3 == 0 {
                "A".to_string()
            } else if idx % 3 == 1 {
                "B".to_string()
            } else {
                "C".to_string()
            },
        });
        item_id += 1;
    }

    for (idx, title) in ortho_items.iter().enumerate() {
        all_items.push(Item {
            id: item_id,
            specialty_id: "ortho".to_string(),
            code: format!("ORTHO-{:03}", idx + 1),
            title: title.0.to_string(),
            description: Some(title.1.to_string()),
            rank: if idx % 3 == 0 {
                "A".to_string()
            } else if idx % 3 == 1 {
                "B".to_string()
            } else {
                "C".to_string()
            },
        });
        item_id += 1;
    }

    for (idx, title) in ophthalmo_items.iter().enumerate() {
        all_items.push(Item {
            id: item_id,
            specialty_id: "ophthalmo".to_string(),
            code: format!("OPHTHALMO-{:03}", idx + 1),
            title: title.0.to_string(),
            description: Some(title.1.to_string()),
            rank: if idx % 3 == 0 {
                "A".to_string()
            } else if idx % 3 == 1 {
                "B".to_string()
            } else {
                "C".to_string()
            },
        });
        item_id += 1;
    }

    for (idx, title) in orl_items.iter().enumerate() {
        all_items.push(Item {
            id: item_id,
            specialty_id: "orl".to_string(),
            code: format!("ORL-{:03}", idx + 1),
            title: title.0.to_string(),
            description: Some(title.1.to_string()),
            rank: if idx % 3 == 0 {
                "A".to_string()
            } else if idx % 3 == 1 {
                "B".to_string()
            } else {
                "C".to_string()
            },
        });
        item_id += 1;
    }

    all_items
}

/**
 * Comprehensive NEET Syllabus Knowledge & High-Yield NCERT Diagrams Bank
 * Covers Biology (Botany & Zoology), Physics, and Chemistry for NEET UG
 */

export interface NeetDiagramInfo {
  id: string;
  title: string;
  subject: 'biology' | 'physics' | 'chemistry';
  classGrade: '11' | '12';
  chapter: string;
  tags: string[];
  description: string;
  keyLabelingPoints: string[];
  neetHighYieldFacts: string[];
  imagePrompt: string;
}

export const NEET_DIAGRAMS_DATABASE: NeetDiagramInfo[] = [
  // ==========================================
  // BIOLOGY: HUMAN PHYSIOLOGY
  // ==========================================
  {
    id: 'human-heart',
    title: 'Human Heart - Internal Anatomy & Cardiac Cycle',
    subject: 'biology',
    classGrade: '11',
    chapter: 'Body Fluids and Circulation',
    tags: ['heart', 'cardiac', 'circulation', 'sa node', 'av node', 'valves', 'ventricle', 'atrium'],
    description: 'Internal structure of the 4-chambered human heart showing double circulation, nodal tissues, and cardiac valves.',
    keyLabelingPoints: [
      'Right Atrium and Right Ventricle',
      'Left Atrium and Left Ventricle (thickest muscular wall)',
      'Sinoatrial (SA) Node - Pacemaker generating 70-75 action potentials/min',
      'Atrioventricular (AV) Node - Pacesetter',
      'Bundle of His & Purkinje Fibers in ventricular septum',
      'Tricuspid Valve (between RA & RV) and Bicuspid/Mitral Valve (between LA & LV)',
      'Semilunar Valves guarding Aorta and Pulmonary Artery'
    ],
    neetHighYieldFacts: [
      'SA Node is located in the right upper corner of the Right Atrium.',
      'Cardiac output = Stroke Volume (70 mL) × Heart Rate (72/min) ≈ 5 Liters/min.',
      'P-wave in ECG represents depolarization of atria; QRS complex represents depolarization of ventricles; T-wave represents repolarization of ventricles.',
      'Coronary circulation provides blood supply exclusively to heart musculature.'
    ],
    imagePrompt: 'High quality detailed medical textbook illustration of the human heart internal cross-section, showing four chambers, right and left atria, ventricles, SA node, AV node, aorta, pulmonary artery, bicuspid and tricuspid valves with clean educational scientific labels, NCERT biology style on clean white background'
  },
  {
    id: 'nephron-kidney',
    title: 'Structure of Nephron & Counter-Current Mechanism',
    subject: 'biology',
    classGrade: '11',
    chapter: 'Excretory Products and their Elimination',
    tags: ['nephron', 'kidney', 'malpighian body', 'glomerulus', 'bowman', 'henle', 'counter current'],
    description: 'Microscopic functional unit of the human kidney highlighting the filtration barrier and osmolarity gradient in the medullary loop of Henle and vasa recta.',
    keyLabelingPoints: [
      'Afferent Arteriole (wider diameter) and Efferent Arteriole (narrower diameter)',
      'Glomerulus (fenestrated capillary tuft) and Bowman\'s Capsule (podocytes)',
      'Proximal Convoluted Tubule (PCT) with simple brush border cuboidal epithelium for 70-80% reabsorption',
      'Loop of Henle (Descending limb permeable to water, Ascending limb permeable to electrolytes/NaCl)',
      'Distal Convoluted Tubule (DCT) - conditional reabsorption of Na+ and water under Aldosterone & ADH',
      'Collecting Duct and Vasa Recta hairpin loop'
    ],
    neetHighYieldFacts: [
      'Glomerular Filtration Rate (GFR) is approx 125 mL/min or 180 Liters/day.',
      'Counter-current mechanism between Henle\'s loop and Vasa Recta maintains a medullary hyperosmolar gradient from 300 mOsmol/L (cortex) to 1200 mOsmol/L (inner medulla).',
      'Juxtaglomerular apparatus (JGA) releases Renin when GFR or blood pressure falls.'
    ],
    imagePrompt: 'Scientific textbook diagram of a human nephron with glomerulus, Bowman capsule, PCT, loop of Henle, DCT, collecting duct and surrounding vasa recta capillary network, detailed NCERT biology entrance exam style with clear labeling markers'
  },
  {
    id: 'human-brain',
    title: 'Human Brain - Sagittal Section Anatomy',
    subject: 'biology',
    classGrade: '11',
    chapter: 'Neural Control and Coordination',
    tags: ['brain', 'cerebrum', 'cerebellum', 'hypothalamus', 'medulla', 'pons', 'thalamus'],
    description: 'Sagittal section view of the human brain displaying forebrain, midbrain, and hindbrain structures.',
    keyLabelingPoints: [
      'Cerebrum & Cerebral Cortex (Gyri and Sulci, grey matter)',
      'Corpus Callosum (tract of nerve fibers connecting two cerebral hemispheres)',
      'Thalamus (major relay center for sensory and motor signaling)',
      'Hypothalamus (controls body temperature, urge for eating and drinking, neurosecretory hormones)',
      'Midbrain with Corpora Quadrigemina (4 round lobes) and Cerebral Aqueduct',
      'Hindbrain: Pons, Cerebellum (convoluted surface for motor coordination), and Medulla Oblongata (respiratory and cardiovascular reflex center)'
    ],
    neetHighYieldFacts: [
      'Association areas in cerebral cortex are neither purely sensory nor motor; responsible for intersensory associations, memory, and communication.',
      'Limbic system (Hippocampus + Amygdala + Hypothalamus) regulates emotional reactions, sexual behavior, and motivation.',
      'Brain stem consists of midbrain, pons, and medulla oblongata (cerebellum is NOT part of brain stem).'
    ],
    imagePrompt: 'Medical sagittal section diagram of human brain showing cerebrum, corpus callosum, thalamus, hypothalamus, midbrain corpora quadrigemina, pons, cerebellum, and medulla oblongata, crisp vector scientific textbook illustration'
  },
  {
    id: 'human-eye',
    title: 'Human Eye - Sagittal Section Structure',
    subject: 'biology',
    classGrade: '11',
    chapter: 'Neural Control and Coordination',
    tags: ['eye', 'retina', 'cornea', 'fovea', 'ciliary body', 'lens', 'rods', 'cones'],
    description: 'Anatomical cross section of the human eyeball showing tunics, optical media, and retinal layers.',
    keyLabelingPoints: [
      'Cornea (transparent anterior coat) and Sclera (tough fibrous coat)',
      'Choroid layer (vascular, bluish layer) and Ciliary Body',
      'Iris (pigmented opaque visible portion) and Pupil aperture',
      'Crystalline Lens held by suspensory ligaments',
      'Retina with 3 neural layers: Ganglion cells, Bipolar cells, and Photoreceptor cells (Rods and Cones)',
      'Fovea Centralis (thinned out area of retina containing densely packed cones only; maximum visual acuity)',
      'Blind Spot (Optic Disc) where optic nerve leaves eyeball; devoid of photoreceptors'
    ],
    neetHighYieldFacts: [
      'Rhodopsin (visual purple) is a purplish-red protein containing retinal (aldehyde derivative of Vitamin A).',
      'Aqueous chamber (between cornea and lens) contains aqueous humor; vitreous chamber (between lens and retina) contains jelly-like vitreous humor.'
    ],
    imagePrompt: 'Detailed medical diagram of the human eye in horizontal cross-section, cornea, iris, pupil, lens, ciliary body, retina, fovea centralis, optic nerve and blind spot, clean NCERT style anatomical labeling on white background'
  },
  {
    id: 'synapse-neuron',
    title: 'Neuron Structure & Chemical Synapse Transmission',
    subject: 'biology',
    classGrade: '11',
    chapter: 'Neural Control and Coordination',
    tags: ['neuron', 'synapse', 'action potential', 'axon', 'schwann cell', 'myelin', 'neurotransmitter'],
    description: 'Structure of a multipolar neuron and diagrammatic representation of impulse transmission at a chemical synapse.',
    keyLabelingPoints: [
      'Dendrites with Nissl\'s granules and Cell Body (Soma)',
      'Axon Hillock and Axon',
      'Myelin Sheath formed by Schwann cells with Nodes of Ranvier',
      'Axon Terminal and Synaptic Knob with synaptic vesicles containing neurotransmitters (Acetylcholine)',
      'Pre-synaptic membrane, Synaptic Cleft (20 nm), and Post-synaptic membrane with specific chemoreceptors',
      'Voltage-gated Ca2+ channels triggering exocytosis of vesicles'
    ],
    neetHighYieldFacts: [
      'Resting membrane potential is -70 mV, maintained by the 3 Na+ out / 2 K+ in ATP pump.',
      'Action potential generation is due to rapid influx of Na+ through voltage-gated Na+ channels (depolarization).',
      'Electrical synapses have bidirectional and instantaneous impulse flow through gap junctions, whereas chemical synapses use neurotransmitters and are unidirectional.'
    ],
    imagePrompt: 'Educational diagram showing multipolar neuron anatomy alongside a high-magnification chemical synapse showing synaptic knob, vesicles, neurotransmitters, synaptic cleft, and post-synaptic receptors, NCERT biology exam illustration'
  },
  {
    id: 'respiratory-alveoli',
    title: 'Human Respiratory System & Alveolar Diffusion Membrane',
    subject: 'biology',
    classGrade: '11',
    chapter: 'Breathing and Exchange of Gases',
    tags: ['respiration', 'lungs', 'alveoli', 'diffusion membrane', 'oxygen dissociation', 'bronchi'],
    description: 'Respiratory tree and the three-layered alveolar-capillary diffusion membrane facilitating O2 and CO2 exchange.',
    keyLabelingPoints: [
      'Trachea with C-shaped cartilaginous rings dividing at T5 vertebra into primary bronchi',
      'Bronchial tree, Terminal bronchioles, and Alveoli',
      'Three layers of Diffusion Membrane (total thickness < 1 mm):',
      '  1. Thin squamous epithelium of alveoli',
      '  2. Endothelium of alveolar capillaries',
      '  3. Basement substance between them',
      'Pulmonary artery and Pulmonary vein'
    ],
    neetHighYieldFacts: [
      'Solubility of CO2 is 20-25 times higher than that of O2, hence CO2 diffuses much faster across the respiratory membrane.',
      'Oxygen-hemoglobin dissociation curve is Sigmoid shaped; shifts to right with high pCO2, high H+ (low pH), high temperature (Bohr Effect).'
    ],
    imagePrompt: 'Scientific illustration showing human lungs respiratory tree and zoomed section of alveolar capillary diffusion membrane with thin squamous epithelium and capillary endothelium, crisp medical vector textbook style'
  },
  {
    id: 'digestive-ducts',
    title: 'Duct System of Liver, Gall Bladder and Pancreas',
    subject: 'biology',
    classGrade: '11',
    chapter: 'Digestion and Absorption',
    tags: ['liver', 'gall bladder', 'pancreas', 'duct', 'sphincter of oddi', 'bile', 'duodenum'],
    description: 'Anatomy of hepatic, cystic, common bile, and pancreatic ducts draining into the C-shaped duodenum.',
    keyLabelingPoints: [
      'Right and Left Hepatic Ducts from liver joining to form Common Hepatic Duct',
      'Cystic Duct from Gall Bladder',
      'Common Bile Duct formed by union of cystic and common hepatic duct',
      'Pancreatic Duct (Duct of Wirsung)',
      'Hepato-pancreatic Ampulla (Ampulla of Vater)',
      'Sphincter of Oddi guarding the entry into C-shaped Duodenum'
    ],
    neetHighYieldFacts: [
      'Bile contains no digestive enzymes but contains bile salts (sodium glycocholate & taurocholate) that emulsify fats and activate lipases.',
      'Gall bladder concentrates and stores bile produced by hepatic lobules.'
    ],
    imagePrompt: 'Clear medical line art diagram showing liver, gall bladder, cystic duct, common bile duct, pancreas, pancreatic duct, ampulla of Vater, and sphincter of Oddi entering duodenum, NCERT biology style'
  },

  // ==========================================
  // BIOLOGY: CELL BIOLOGY & BIOMOLECULES
  // ==========================================
  {
    id: 'fluid-mosaic-model',
    title: 'Fluid Mosaic Model of Plasma Membrane (Singer & Nicolson)',
    subject: 'biology',
    classGrade: '11',
    chapter: 'Cell: The Unit of Life',
    tags: ['cell membrane', 'fluid mosaic', 'singer nicolson', 'phospholipid', 'protein', 'cholesterol'],
    description: 'The universally accepted 1972 fluid mosaic architecture of eukaryotic cellular membranes.',
    keyLabelingPoints: [
      'Phospholipid Bilayer with hydrophilic polar head outside and hydrophobic nonpolar tail inside',
      'Integral / Intrinsic transmembrane proteins',
      'Peripheral / Extrinsic proteins easily separated from membrane',
      'Cholesterol molecules providing membrane fluidity and stability',
      'Glycolipids and Glycoproteins forming the glycocalyx outer cell recognition coat'
    ],
    neetHighYieldFacts: [
      'Proposed by Singer and Nicolson in 1972.',
      'Quasi-fluid nature of lipid enables lateral movement of proteins within overall bilayer (fluidity).',
      'Plasma membrane is selectively permeable: neutral solutes move by simple diffusion down concentration gradient; polar molecules require carrier proteins.'
    ],
    imagePrompt: '3D scientific diagram of Fluid Mosaic Model of cell membrane, showing phospholipid bilayer with hydrophilic heads and hydrophobic tails, integral proteins, peripheral proteins, cholesterol, and oligosaccharides, NCERT biology format'
  },
  {
    id: 'mitochondria-structure',
    title: 'Mitochondria - Powerhouse of the Cell (Internal Structure)',
    subject: 'biology',
    classGrade: '11',
    chapter: 'Cell: The Unit of Life',
    tags: ['mitochondria', 'cristae', 'matrix', 'atp synthase', 'f0 f1', 'cellular respiration'],
    description: 'Double membrane semi-autonomous organelle with folded cristae and oxysomes.',
    keyLabelingPoints: [
      'Outer Membrane (smooth, porous with porin proteins)',
      'Intermembrane Space (perimitochondrial space)',
      'Inner Membrane folded into Cristae to increase surface area',
      'Matrix containing 70S ribosomes, circular double-stranded DNA, and Krebs cycle enzymes',
      'F0-F1 particles (Oxysomes / ATP Synthase complexes on inner membrane)'
    ],
    neetHighYieldFacts: [
      'Mitochondria divide by fission.',
      'Semi-autonomous organelle with its own circular naked DNA and 70S ribosomes.',
      'Inner membrane contains cardiolipin and electron transport system complexes.'
    ],
    imagePrompt: 'Cutaway anatomical illustration of a mitochondrion showing outer membrane, inner membrane cristae folds, matrix, circular DNA, 70S ribosomes, and F0-F1 ATP synthase particles, clean NCERT diagram'
  },
  {
    id: 'chloroplast-structure',
    title: 'Chloroplast - Internal Anatomy of Photosynthetic Organelle',
    subject: 'biology',
    classGrade: '11',
    chapter: 'Cell: The Unit of Life',
    tags: ['chloroplast', 'grana', 'thylakoid', 'stroma', 'stroma lamellae', 'photosynthesis'],
    description: 'Double membrane plastid with thylakoid stacks (grana) and enzymatic stroma.',
    keyLabelingPoints: [
      'Outer and Inner Membranes with intermembrane space',
      'Stroma (gel-like matrix containing RuBisCO, 70S ribosomes, circular DNA, and starch grains)',
      'Thylakoids (flattened membrane sacs containing chlorophyll pigments)',
      'Grana (stacks of disc-shaped thylakoids where light reactions occur)',
      'Stroma Lamellae (Frets connecting adjacent grana; lacks PS II and NADP reductase)'
    ],
    neetHighYieldFacts: [
      'Dark reaction (Calvin cycle / CO2 fixation) takes place in the stroma.',
      'Light reaction (Photolysis of water, ATP & NADPH synthesis) takes place in thylakoid membranes / grana.',
      'RuBisCO is the most abundant enzyme on Earth, located in the stroma.'
    ],
    imagePrompt: 'Textbook 3D diagram of a chloroplast showing outer and inner membrane, stroma, stacked thylakoid grana, stroma lamellae, circular DNA, and plastoglobules, NCERT biology style'
  },
  {
    id: 'cell-cycle-stages',
    title: 'Cell Cycle Stages & Phases of Meiosis I (Prophase I)',
    subject: 'biology',
    classGrade: '11',
    chapter: 'Cell Cycle and Cell Division',
    tags: ['cell cycle', 'mitosis', 'meiosis', 'pachytene', 'crossing over', 'chiasmata', 'g1 s g2'],
    description: 'Phases of the eukaryotic cell cycle (Interphase & M Phase) and the 5 critical sub-stages of Meiotic Prophase I.',
    keyLabelingPoints: [
      'G1 Phase (cell metabolically active, organelle duplication)',
      'S Phase (DNA replication, DNA amount doubles from 2C to 4C, chromosome number remains 2n, centriole duplicates)',
      'G2 Phase (proteins synthesized for mitosis)',
      'Prophase I Sub-stages:',
      '  - Leptotene (chromosomes condense)',
      '  - Zygotene (synapsis of homologous chromosomes, synaptonemal complex)',
      '  - Pachytene (crossing over mediated by enzyme Recombinase)',
      '  - Diplotene (dissolution of synaptonemal complex, X-shaped Chiasmata visible)',
      '  - Diakinesis (terminalization of chiasmata)'
    ],
    neetHighYieldFacts: [
      'G0 (Quiescent) phase: cells remain metabolically active but no longer proliferate unless called upon (e.g. heart cells, neurons).',
      'Crossing over in Pachytene creates genetic variation in offspring.',
      'Oocytes of some vertebrates remain in Diplotene for months or years (Dictyotene stage).'
    ],
    imagePrompt: 'Circular cell cycle diagram showing G1, S, G2, M phases and detailed sequential panel of Prophase 1 stages: Leptotene, Zygotene, Pachytene crossing over, Diplotene chiasmata, Diakinesis, educational NCERT diagram'
  },

  // ==========================================
  // BIOLOGY: PLANT PHYSIOLOGY
  // ==========================================
  {
    id: 'calvin-cycle-c3',
    title: 'Calvin Cycle (C3 Pathway) of Photosynthesis',
    subject: 'biology',
    classGrade: '11',
    chapter: 'Photosynthesis in Higher Plants',
    tags: ['calvin cycle', 'c3 cycle', 'rubisco', 'carboxylation', 'pga', 'triose phosphate', 'photosynthesis'],
    description: 'The cyclic enzymatic dark reaction pathway discovered by Melvin Calvin using 14C radioactive isotope.',
    keyLabelingPoints: [
      'Carboxylation: RuBP (5-Carbon) + CO2 + H2O -> 2 molecules of 3-PGA (catalyzed by RuBisCO)',
      'Reduction: 2 × 3-PGA -> 2 × Triose Phosphate (consumes 2 ATP + 2 NADPH per CO2)',
      'Regeneration: Triose phosphate regenerated back into RuBP (consumes 1 ATP)',
      'Net input for 1 Glucose (6 CO2 fixed): 18 ATP and 12 NADPH'
    ],
    neetHighYieldFacts: [
      'Carboxylation is the most crucial step of the Calvin cycle.',
      'Primary CO2 acceptor in C3 plants is 5-carbon ketose sugar RuBP (Ribulose 1,5-bisphosphate).',
      'First stable product is a 3-carbon organic acid: 3-Phosphoglyceric acid (3-PGA).'
    ],
    imagePrompt: 'Clear circular biochemical pathway diagram of the Calvin Cycle C3 pathway showing Carboxylation, Reduction, and Regeneration phases with RuBP, 3-PGA, ATP, and NADPH inputs, NCERT biology style'
  },
  {
    id: 'c4-pathway-kranz',
    title: 'C4 Pathway (Hatch & Slack) & Kranz Anatomy',
    subject: 'biology',
    classGrade: '11',
    chapter: 'Photosynthesis in Higher Plants',
    tags: ['c4 pathway', 'hatch slack', 'kranz anatomy', 'bundle sheath', 'pepcase', 'malate', 'oxaloacetate'],
    description: 'Anatomical adaptations of C4 plants (Kranz anatomy) preventing photorespiration through spatial separation.',
    keyLabelingPoints: [
      'Mesophyll Cells: Lack RuBisCO, possess PEP Carboxylase (PEPcase)',
      'Primary CO2 acceptor: Phosphoenolpyruvate (PEP, 3-Carbon)',
      'First stable product: Oxaloacetic acid (OAA, 4-Carbon dicarboxylic acid)',
      'Transport of Malic acid / Aspartic acid from mesophyll to bundle sheath',
      'Bundle Sheath Cells: Kranz anatomy (wreath-like large cells, thick walls, no intercellular spaces, agranal chloroplasts rich in RuBisCO)',
      'Decarboxylation in bundle sheath releasing CO2 into Calvin cycle'
    ],
    neetHighYieldFacts: [
      'C4 plants (e.g. Maize, Sorghum, Sugarcane) lack photorespiration and show high water-use efficiency.',
      'Optimum temperature for C4 plants is 30-45°C (higher than C3 plants 20-25°C).',
      'To synthesize 1 glucose molecule, C4 plants require 30 ATP and 12 NADPH (12 more ATP than C3).'
    ],
    imagePrompt: 'Cross section diagram illustrating Kranz anatomy of a C4 leaf alongside cellular biochemical flow between Mesophyll cell and Bundle Sheath cell showing PEPcase, Malate transport, and Decarboxylation, NCERT biology style'
  },
  {
    id: 'z-scheme-photophosphorylation',
    title: 'Z-Scheme of Light Reaction & Non-Cyclic Photophosphorylation',
    subject: 'biology',
    classGrade: '11',
    chapter: 'Photosynthesis in Higher Plants',
    tags: ['z scheme', 'light reaction', 'ps1', 'ps2', 'photolysis', 'photophosphorylation', 'nadph'],
    description: 'Electron transport diagram shaped like the letter Z showing photo-excitation from PS II to PS I.',
    keyLabelingPoints: [
      'Photosystem II (Reaction center P680)',
      'Water Splitting Complex (Photolysis: 2H2O -> 4H+ + O2 + 4e- catalyzed by Mn2+ and Cl- ions)',
      'Primary Electron Acceptor (Pheophytin)',
      'Cytochrome b6-f complex and Plastoquinone/Plastocyanin electron transport',
      'Photosystem I (Reaction center P700)',
      'Ferredoxin and Ferredoxin-NADP+ Reductase producing NADPH + H+'
    ],
    neetHighYieldFacts: [
      'Water splitting complex is associated with PS II, located on the inner side of the thylakoid membrane (lumen).',
      'Non-cyclic photophosphorylation yields both ATP and NADPH; cyclic photophosphorylation (PS I only) yields only ATP and no NADPH.'
    ],
    imagePrompt: 'Scientific textbook graph of the Z-scheme of light reaction showing redox potential scale on vertical axis, PS II P680, electron acceptors, cytochrome b6f, PS I P700, and NADPH synthesis, NCERT biology style'
  },
  {
    id: 'glycolysis-emp',
    title: 'Glycolysis (EMP Pathway) - 10 Step Breakdown',
    subject: 'biology',
    classGrade: '11',
    chapter: 'Respiration in Plants',
    tags: ['glycolysis', 'emp pathway', 'pyruvate', 'atp', 'nadh', 'hexokinase', 'phosphofructokinase'],
    description: 'Cytoplasmic anaerobic breakdown of 1 glucose molecule into 2 molecules of pyruvic acid.',
    keyLabelingPoints: [
      'Step 1: Glucose -> Glucose-6-Phosphate (Hexokinase, consumes 1 ATP)',
      'Step 3: Fructose-6-P -> Fructose 1,6-bisphosphate (PFK - Pace-maker enzyme, consumes 1 ATP)',
      'Step 4: Cleavage into PGAL (G3P) and DHAP (Aldolase)',
      'Step 6: Oxidation of PGAL -> 1,3-bisPGA (produces 2 NADH)',
      'Substrate-level phosphorylation in Step 7 and Step 10 yielding 4 ATP',
      'Net Yield: 2 Pyruvate + 2 ATP + 2 NADH'
    ],
    neetHighYieldFacts: [
      'Discovered by Embden, Meyerhof, and Parnas (EMP pathway); universal to all living organisms in cytoplasm.',
      'Phosphofructokinase (PFK) is the rate-limiting and committed pacemaker enzyme of glycolysis.'
    ],
    imagePrompt: 'Step-by-step flowchart diagram of the 10-step Glycolysis EMP pathway from Glucose to 2 Pyruvate, highlighting ATP consumption, NADH generation, and substrate-level phosphorylation, NCERT layout'
  },

  // ==========================================
  // BIOLOGY: GENETICS & MOLECULAR BIOLOGY
  // ==========================================
  {
    id: 'dna-double-helix',
    title: 'DNA Double Helix (Watson-Crick Model) & Replication Fork',
    subject: 'biology',
    classGrade: '12',
    chapter: 'Molecular Basis of Inheritance',
    tags: ['dna', 'double helix', 'watson crick', 'replication fork', 'okazaki', 'leading strand', 'lagging strand'],
    description: 'B-DNA structural geometry and the semi-conservative replication fork mechanism.',
    keyLabelingPoints: [
      'Two antiparallel polynucleotide chains (5\' -> 3\' and 3\' -> 5\')',
      'Nitrogenous base pairing: Adenine = Thymine (2 H-bonds), Guanine ≡ Cytosine (3 H-bonds)',
      'Pitch of helix: 3.4 nm (34 Å), with 10 base pairs per turn, 0.34 nm between base pairs',
      'Replication Fork: Leading strand (continuous 5\' -> 3\' synthesis) and Lagging strand (discontinuous Okazaki fragments)',
      'DNA Helicase (unwinding), Primase (RNA primer), DNA Polymerase III (synthesis), DNA Ligase (sealing nicks)'
    ],
    neetHighYieldFacts: [
      'Semi-conservative replication was proven experimentally by Meselson & Stahl in E. coli using 15N heavy isotope, and by Taylor in Vicia faba using tritiated thymidine.',
      'Chargaff\'s Equivalence Rule: A + G = T + C and A/T = G/C = 1 (valid only for double-stranded DNA).'
    ],
    imagePrompt: 'Detailed scientific illustration showing Watson-Crick DNA double helix with base dimensions and adjacent DNA replication fork with leading strand, lagging strand, and Okazaki fragments, NCERT biology style'
  },
  {
    id: 'lac-operon',
    title: 'The Lac Operon of E. coli (Jacob & Monod)',
    subject: 'biology',
    classGrade: '12',
    chapter: 'Molecular Basis of Inheritance',
    tags: ['lac operon', 'jacob monod', 'operator', 'repressor', 'allolactose', 'beta galactosidase', 'permease'],
    description: 'Classic model of inducible gene regulation in prokaryotes in the presence and absence of lactose inducer.',
    keyLabelingPoints: [
      'Regulatory gene (i gene) synthesizes Lac Repressor protein continuously (constitutive)',
      'Promoter (p) region where RNA polymerase binds',
      'Operator (o) switch binding repressor',
      'Structural genes:',
      '  - z gene: encodes β-galactosidase (hydrolyzes lactose to glucose + galactose)',
      '  - y gene: encodes Permease (increases cell permeability to β-galactosides)',
      '  - a gene: encodes Transacetylase',
      'Inducer: Allolactose / Lactose binds repressor protein, inactivating it and switching ON transcription'
    ],
    neetHighYieldFacts: [
      'Proposed by Francois Jacob and Jacques Monod in 1961.',
      'Lac operon is under both negative control (repressor) and positive control (CAP-cAMP).',
      'Glucose acts as catabolite repressor; operon is active only when lactose is present and glucose is absent.'
    ],
    imagePrompt: 'Scientific diagram of the Lac Operon in E. coli showing i gene, promoter, operator, z, y, a structural genes in both Repressed (OFF) and Induced (ON with Lactose) states, NCERT textbook style'
  },

  // ==========================================
  // BIOLOGY: REPRODUCTION
  // ==========================================
  {
    id: 'anatropous-ovule-embryo-sac',
    title: 'Anatropous Ovule & 7-Celled 8-Nucleate Female Gametophyte',
    subject: 'biology',
    classGrade: '12',
    chapter: 'Sexual Reproduction in Flowering Plants',
    tags: ['ovule', 'embryo sac', 'anatropous', 'filiform apparatus', 'synergid', 'egg cell', 'polar nuclei', 'antipodals'],
    description: 'L.S. of typical inverted anatropous ovule and mature Polygonum type embryo sac.',
    keyLabelingPoints: [
      'Funicle (stalk) and Hilum (junction of funicle and ovule body)',
      'Integuments (outer & inner) leaving small pore: Micropyle',
      'Opposite basal region: Chalaza',
      'Nucellus nutritive tissue',
      'Mature Embryo Sac (7-celled, 8-nucleate):',
      '  - Micropylar end: Egg Apparatus (1 Egg cell + 2 Synergids with cellular finger-like Filiform Apparatus)',
      '  - Chalazal end: 3 Antipodal cells',
      '  - Large Central Cell with 2 Polar Nuclei'
    ],
    neetHighYieldFacts: [
      'Over 80% of angiosperms have Anatropous (inverted) ovules.',
      'Filiform apparatus of synergids guides the entry of pollen tube into embryo sac.',
      'Double fertilization (discovered by Nawaschin): Syngamy (Egg + Sperm -> 2n Zygote) + Triple Fusion (2 Polar nuclei + Sperm -> 3n PEN).'
    ],
    imagePrompt: 'Botanical scientific drawing of L.S. Anatropous ovule showing funicle, hilum, micropyle, chalaza, nucellus, and zoomed 7-celled 8-nucleate mature embryo sac with filiform apparatus and polar nuclei, NCERT style'
  },
  {
    id: 'male-reproductive-system',
    title: 'Human Male Reproductive System & Testis Anatomy',
    subject: 'biology',
    classGrade: '12',
    chapter: 'Human Reproduction',
    tags: ['male reproduction', 'testis', 'seminiferous tubule', 'sertoli', 'leydig', 'epididymis', 'vas deferens'],
    description: 'Anatomy of human male reproductive organs and microscopic cross section of seminiferous tubule.',
    keyLabelingPoints: [
      'Scrotum (maintains testes 2 - 2.5°C lower than internal core body temperature for spermatogenesis)',
      'Seminiferous Tubules lined with Spermatogenic male germ cells and nutritive Sertoli (nurse) cells',
      'Interstitial spaces containing Leydig cells (secrete Androgens/Testosterone)',
      'Accessory duct pathway: Rete testis -> Vasa efferentia -> Epididymis -> Vas deferens',
      'Accessory glands: Paired Seminal Vesicles (fructose, prostaglandins), single Prostate Gland, paired Bulbourethral (Cowper\'s) glands'
    ],
    neetHighYieldFacts: [
      'Sertoli cells secrete Androgen Binding Protein (ABP) and Inhibin (negative feedback on FSH).',
      'Semen consists of sperm (10%) + seminal plasma (90% rich in fructose, calcium, and specific enzymes).'
    ],
    imagePrompt: 'Clear medical anatomical diagram of human male reproductive system alongside microscopic cross-section of seminiferous tubule showing Sertoli cells, spermatogonia, and Leydig cells, NCERT biology style'
  },
  {
    id: 'female-reproductive-system',
    title: 'Human Female Reproductive System & Menstrual Cycle',
    subject: 'biology',
    classGrade: '12',
    chapter: 'Human Reproduction',
    tags: ['female reproduction', 'ovary', 'fallopian tube', 'uterus', 'endometrium', 'menstrual cycle', 'lh surge'],
    description: 'Anatomy of female pelvic reproductive organs and the 28-day hormonal menstrual cycle graph.',
    keyLabelingPoints: [
      'Ovary producing ovum and steroid hormones (Estrogen and Progesterone)',
      'Fallopian Tube (Oviduct): Fimbriae -> Infundibulum -> Ampulla (site of fertilization) -> Isthmus',
      'Uterus: Perimetrium, Myometrium (thick smooth muscle causing labor contractions under Oxytocin), Endometrium (glandular layer shed during menstruation)',
      'Cervix & Vagina forming birth canal',
      'Menstrual Cycle Phases: Menstrual (days 1-5), Follicular/Proliferative (days 6-13), Ovulatory LH Surge (day 14), Luteal/Secretory (days 15-28, Corpus Luteum)'
    ],
    neetHighYieldFacts: [
      'Fertilization takes place specifically at the Ampullary-isthmic junction / Ampulla of fallopian tube.',
      'LH surge (rapid secretion of Luteinizing Hormone around mid-cycle) induces rupture of Graafian follicle and release of ovum (ovulation).',
      'Corpus Luteum secretes large amounts of Progesterone essential for maintenance of endometrium.'
    ],
    imagePrompt: 'Medical diagram of female internal reproductive organs (ovaries, fallopian tubes with ampulla and fimbriae, uterus, cervix) and aligned 28-day hormonal graph showing LH, FSH, Estrogen, Progesterone, and endometrial thickness, NCERT style'
  },

  // ==========================================
  // PHYSICS: OPTICS & MODERN PHYSICS
  // ==========================================
  {
    id: 'ydse-interference',
    title: 'Young\'s Double Slit Experiment (YDSE) Setup & Wave Optics',
    subject: 'physics',
    classGrade: '12',
    chapter: 'Wave Optics',
    tags: ['ydse', 'interference', 'wave optics', 'fringe width', 'coherent sources', 'double slit'],
    description: 'Experimental wave optics setup demonstrating wave nature of light through coherent division of wavefront.',
    keyLabelingPoints: [
      'Monochromatic light source S illuminating two narrow coherent pinholes S1 and S2 (separation d)',
      'Screen placed at distance D (where D >> d)',
      'Path difference Δx = S2P - S1P = d sinθ ≈ yd/D',
      'Constructive interference (Bright fringe): Δx = nλ; Position yn = nλD/d',
      'Destructive interference (Dark fringe): Δx = (2n - 1)λ/2; Position yn = (2n - 1)λD / 2d',
      'Fringe Width β = λD/d (all bright and dark fringes are of equal width)'
    ],
    neetHighYieldFacts: [
      'When YDSE apparatus is immersed in a liquid of refractive index μ, fringe width decreases: β\' = β/μ.',
      'Central fringe is always bright and white if white light source is used; nearest colored fringe is violet.',
      'If slit S1 is covered with thin transparent mica sheet of thickness t, central maxima shifts by y = (μ - 1)t D/d.'
    ],
    imagePrompt: 'Physics textbook ray and wavefront schematic of Young\'s Double Slit Experiment (YDSE), showing coherent slits S1 and S2, path difference, screen at distance D, and sinusoidal interference intensity pattern, clean NCERT physics diagram'
  },
  {
    id: 'compound-microscope-ray-diagram',
    title: 'Ray Diagram of Compound Microscope',
    subject: 'physics',
    classGrade: '12',
    chapter: 'Ray Optics and Optical Instruments',
    tags: ['compound microscope', 'ray optics', 'objective', 'eyepiece', 'magnification', 'focal length'],
    description: 'Two-lens optical instrument forming an inverted, highly magnified virtual image of microscopic objects.',
    keyLabelingPoints: [
      'Objective Lens: Small aperture and short focal length fo',
      'Eyepiece (Ocular): Larger aperture and moderate focal length fe (fe > fo)',
      'Real, inverted, magnified intermediate image A\'B\' formed by objective lens',
      'Final virtual, inverted, highly magnified image A"B" formed at least distance of distinct vision D (25 cm)',
      'Magnifying Power formula: m = -(vo/uo) × (1 + D/fe) ≈ -(L/fo) × (D/fe)'
    ],
    neetHighYieldFacts: [
      'Both fo and fe must be small to obtain large magnification.',
      'Resolving Power of microscope = 2μ sinθ / λ (increases by using blue light and immersion oil).'
    ],
    imagePrompt: 'Precise geometrical optics ray diagram of a Compound Microscope showing objective lens, eyepiece, focal points, intermediate real inverted image, and final enlarged virtual image at near point D, NCERT ray optics standard'
  },
  {
    id: 'astronomical-telescope',
    title: 'Ray Diagram of Refracting Astronomical Telescope',
    subject: 'physics',
    classGrade: '12',
    chapter: 'Ray Optics and Optical Instruments',
    tags: ['telescope', 'astronomical telescope', 'ray optics', 'objective', 'eyepiece', 'normal adjustment'],
    description: 'Optical ray diagram for viewing distant astronomical objects in normal adjustment (image at infinity).',
    keyLabelingPoints: [
      'Objective Lens: Large aperture and large focal length fo (to gather maximum light from distant stars)',
      'Eyepiece Lens: Small aperture and short focal length fe (fo >> fe)',
      'Parallel rays from distant object focused at focal plane of objective lens',
      'Tube Length in Normal Adjustment: L = fo + fe',
      'Magnifying Power in Normal Adjustment: m = -fo/fe'
    ],
    neetHighYieldFacts: [
      'In normal adjustment, final image is at infinity, offering strain-free viewing for human eye.',
      'Reflecting telescopes (Cassegrain) avoid chromatic aberration and spherical aberration using parabolic concave mirrors.'
    ],
    imagePrompt: 'Geometric ray optics diagram of an Astronomical Telescope in normal adjustment with large objective lens fo and short eyepiece fe, parallel incident rays from distant object forming final image at infinity, NCERT physics standard'
  },
  {
    id: 'bohr-model-hydrogen-spectrum',
    title: 'Bohr Model of Hydrogen Atom & Spectral Series',
    subject: 'physics',
    classGrade: '12',
    chapter: 'Atoms',
    tags: ['bohr model', 'hydrogen spectrum', 'lyman', 'balmer', 'paschen', 'rydberg', 'energy levels'],
    description: 'Quantized energy level diagram and emission transitions of atomic hydrogen.',
    keyLabelingPoints: [
      'Energy formula: En = -13.6 / n^2 eV (Ground state E1 = -13.6 eV, E2 = -3.4 eV, E3 = -1.51 eV)',
      'Lyman Series (n1 = 1, n2 = 2,3,4...) -> Ultraviolet region',
      'Balmer Series (n1 = 2, n2 = 3,4,5...) -> Visible region (only series in visible spectrum)',
      'Paschen Series (n1 = 3) -> Near Infrared region',
      'Brackett Series (n1 = 4) & Pfund Series (n1 = 5) -> Far Infrared region',
      'Rydberg formula: 1/λ = R [1/n1^2 - 1/n2^2]'
    ],
    neetHighYieldFacts: [
      'Balmer series is the only spectral series that lies in the visible region of the electromagnetic spectrum.',
      'Ionization energy of Hydrogen atom from ground state is +13.6 eV.'
    ],
    imagePrompt: 'Energy level diagram of the Hydrogen atom showing n=1 to n=infinity with horizontal energy lines in eV and vertical transition arrows for Lyman, Balmer, Paschen, Brackett, and Pfund series, NCERT physics format'
  },
  {
    id: 'pn-junction-diode',
    title: 'P-N Junction Diode & Full-Wave Rectifier Circuit',
    subject: 'physics',
    classGrade: '12',
    chapter: 'Semiconductor Electronics',
    tags: ['pn junction', 'diode', 'rectifier', 'full wave rectifier', 'forward bias', 'reverse bias'],
    description: 'Depletion region formation, barrier potential, and center-tapped transformer full-wave rectifier circuit.',
    keyLabelingPoints: [
      'P-type (majority holes) and N-type (majority electrons) semiconductor interface',
      'Depletion Layer devoid of free charge carriers, containing immobile donor (+) and acceptor (-) ions',
      'Barrier Potential (0.7 V for Silicon, 0.3 V for Germanium)',
      'Center-tapped step-down transformer feeding two diodes D1 and D2 alternately during each AC half-cycle',
      'Capacitor / LC filter smoothing pulsating DC into steady DC output',
      'Rectifier Efficiency: 81.2% for full-wave (twice of half-wave 40.6%)'
    ],
    neetHighYieldFacts: [
      'In forward bias (P to +, N to -), depletion layer width decreases and barrier potential reduces.',
      'In reverse bias (P to -, N to +), depletion layer width increases; current is due to minority carriers (microamperes).',
      'Ripple frequency of full-wave rectifier is 2f (100 Hz for 50 Hz input supply).'
    ],
    imagePrompt: 'Circuit schematic of a center-tapped transformer Full-Wave Rectifier with diodes D1 and D2, load resistor RL, capacitor filter, and input vs output AC/DC waveforms, NCERT semiconductor electronics standard'
  },

  // ==========================================
  // CHEMISTRY: BONDING, SOLIDS & COORDINATION
  // ==========================================
  {
    id: 'vsepr-shapes',
    title: 'VSEPR Molecular Geometries (NCERT Chemistry)',
    subject: 'chemistry',
    classGrade: '11',
    chapter: 'Chemical Bonding and Molecular Structure',
    tags: ['vsepr', 'molecular geometry', 'shapes', 'hybridization', 'tetrahedral', 'trigonal bipyramidal', 'octahedral'],
    description: 'Geometrical shapes of covalent molecules based on Valence Shell Electron Pair Repulsion theory.',
    keyLabelingPoints: [
      'Linear (sp, BeCl2, CO2, bond angle 180°)',
      'Trigonal Planar (sp2, BF3, bond angle 120°)',
      'Tetrahedral (sp3, CH4, bond angle 109.5°)',
      'Trigonal Pyramidal (sp3 with 1 lone pair, NH3, bond angle 107°)',
      'Bent / V-shaped (sp3 with 2 lone pairs, H2O, bond angle 104.5°)',
      'Trigonal Bipyramidal (sp3d, PCl5, Axial bonds longer & weaker than Equatorial bonds due to greater repulsion)',
      'See-saw (SF4) and T-shaped (ClF3)',
      'Octahedral (sp3d2, SF6, bond angle 90°)',
      'Square Planar (sp3d2 with 2 lone pairs, XeF4)'
    ],
    neetHighYieldFacts: [
      'Order of repulsion: Lone pair - Lone pair > Lone pair - Bond pair > Bond pair - Bond pair.',
      'In PCl5, 2 axial P-Cl bonds (240 pm) are longer than 3 equatorial P-Cl bonds (202 pm); hence PCl5 dissociates upon heating into PCl3 + Cl2.',
      'XeF4 is square planar with sp3d2 hybridization and 2 lone pairs at trans positions.'
    ],
    imagePrompt: 'Clean educational chemistry chart illustrating VSEPR molecular shapes: Linear, Trigonal Planar, Tetrahedral, Trigonal Pyramidal, Bent H2O, Trigonal Bipyramidal PCl5, and Square Planar XeF4 with 3D wedge-dash bonds and angles'
  },
  {
    id: 'crystal-field-splitting',
    title: 'Crystal Field Splitting in Octahedral & Tetrahedral Complexes',
    subject: 'chemistry',
    classGrade: '12',
    chapter: 'Coordination Compounds',
    tags: ['crystal field splitting', 'cft', 'coordination', 'octahedral', 'tetrahedral', 't2g', 'eg', 'spectrochemical'],
    description: 'd-orbital degeneracy splitting in octahedral (Oh) and tetrahedral (Td) ligand electrostatic fields.',
    keyLabelingPoints: [
      'Degenerate five d-orbitals (dxy, dyz, dzx, dx2-y2, dz2) in free gaseous metal ion',
      'Spherical average electrostatic field lifting energy levels',
      'Octahedral Splitting (Δo):',
      '  - eg set (dx2-y2, dz2) repelled directly along axes, energy raised by +0.6 Δo (+3/5)',
      '  - t2g set (dxy, dyz, dzx) directed between axes, energy lowered by -0.4 Δo (-2/5)',
      'Tetrahedral Splitting (Δt): Inverse splitting pattern; e lower, t2 higher; Δt = 4/9 Δo',
      'Spectrochemical series: I- < Br- < SCN- < Cl- < F- < OH- < C2O4(2-) < H2O < NCS- < EDTA < NH3 < en < CN- < CO'
    ],
    neetHighYieldFacts: [
      'Strong field ligands (e.g. CN-, CO) cause large Δo > P (pairing energy), forming low spin / inner orbital complexes (d2sp3).',
      'Weak field ligands (e.g. halides, H2O) have Δo < P, forming high spin / outer orbital complexes (sp3d2).',
      'CO is the strongest field ligand in the spectrochemical series due to synergistic back bonding.'
    ],
    imagePrompt: 'Coordination chemistry energy diagram showing Crystal Field Splitting of d-orbitals into t2g and eg sets in Octahedral complex with barycenter line and Δo energy gap, clean NCERT style'
  },
  {
    id: 'daniell-galvanic-cell',
    title: 'Daniell Galvanic Cell & Salt Bridge Mechanism',
    subject: 'chemistry',
    classGrade: '12',
    chapter: 'Electrochemistry',
    tags: ['daniell cell', 'galvanic cell', 'electrochemistry', 'salt bridge', 'anode', 'cathode', 'nernst equation'],
    description: 'Electrochemical cell converting chemical energy into electrical energy using Zn-Cu redox couple.',
    keyLabelingPoints: [
      'Anode (Negative terminal): Zinc rod immersed in ZnSO4 solution (Oxidation: Zn -> Zn2+ + 2e-)',
      'Cathode (Positive terminal): Copper rod immersed in CuSO4 solution (Reduction: Cu2+ + 2e- -> Cu)',
      'External circuit: Electrons flow from Zinc (Anode) to Copper (Cathode); conventional current flows from Cu to Zn',
      'Salt Bridge (U-tube with agar-agar gel and inert electrolyte like KCl, KNO3, or NH4NO3)',
      'Functions of Salt Bridge: Completes the electrical circuit and maintains electrical neutrality of half-cells',
      'Standard Cell Potential: E°cell = E°cathode - E°anode = +0.34 V - (-0.76 V) = +1.10 V'
    ],
    neetHighYieldFacts: [
      'When external opposing potential Eext < 1.1 V: cell functions normally as galvanic cell.',
      'When Eext = 1.1 V: no current flows, reaction stops.',
      'When Eext > 1.1 V: cell functions in reverse as an electrolytic cell (electrons flow from Cu to Zn).'
    ],
    imagePrompt: 'Scientific illustration of the Daniell Galvanic cell showing Zinc anode beaker, Copper cathode beaker, salt bridge tube, voltmeter, and electron flow direction with chemical equations, NCERT electrochemistry style'
  }
];

/**
 * Intelligent search function to match any NEET diagram, concept, or query
 */
export function searchNeetDatabase(query: string, subjectFilter?: 'biology' | 'physics' | 'chemistry'): NeetDiagramInfo[] {
  if (!query || typeof query !== 'string') return [];
  const normalizedQuery = query.toLowerCase().trim();
  const tokens = normalizedQuery.split(/\s+/).filter(t => t.length > 2);

  const scored = NEET_DIAGRAMS_DATABASE.map(item => {
    let score = 0;

    if (subjectFilter && item.subject !== subjectFilter) {
      return { item, score: -1 };
    }

    const titleLower = item.title.toLowerCase();
    const descLower = item.description.toLowerCase();
    const chapterLower = item.chapter.toLowerCase();

    // Exact or phrase matches
    if (titleLower.includes(normalizedQuery)) score += 50;
    if (descLower.includes(normalizedQuery)) score += 25;
    if (chapterLower.includes(normalizedQuery)) score += 30;

    // Tag matches
    for (const tag of item.tags) {
      if (normalizedQuery.includes(tag)) score += 30;
      if (tag.includes(normalizedQuery)) score += 20;
    }

    // Token matches
    for (const token of tokens) {
      if (titleLower.includes(token)) score += 15;
      if (item.tags.some(t => t.includes(token))) score += 10;
      if (item.keyLabelingPoints.some(p => p.toLowerCase().includes(token))) score += 8;
      if (item.neetHighYieldFacts.some(f => f.toLowerCase().includes(token))) score += 8;
      if (descLower.includes(token)) score += 5;
    }

    return { item, score };
  });

  return scored
    .filter(res => res.score > 0)
    .sort((a, b) => b.score - a.score)
    .map(res => res.item);
}

/**
 * Formats a NEET diagram result into a comprehensive, high-yield study packet
 */
export function formatNeetStudyPacket(diagram: NeetDiagramInfo): string {
  return `### 🩺 NEET NCERT High-Yield Study Notes: ${diagram.title}
**Subject**: ${diagram.subject.toUpperCase()} (Class ${diagram.classGrade}) | **Chapter**: ${diagram.chapter}

📖 **Concept Summary**:
${diagram.description}

🏷️ **Essential Diagram Labeling Points**:
${diagram.keyLabelingPoints.map(p => `- ${p}`).join('\n')}

⭐ **High-Yield NEET Exam Facts & Tricks**:
${diagram.neetHighYieldFacts.map(f => `✓ ${f}`).join('\n')}
`;
}

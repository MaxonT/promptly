#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
法语翻译脚本 - 补充缺失的 200 个键
基于 en.json 进行专业翻译
"""

import json

# 读取英文和现有法语翻译
with open('frontend/locales/en.json', 'r', encoding='utf-8') as f:
    en = json.load(f)

with open('frontend/locales/fr.json', 'r', encoding='utf-8') as f:
    fr = json.load(f)

# 法语翻译映射
fr_translations = {
    # Common module
    "common": {
        "appName": "Promptly",
        "welcome": "Bienvenue",
        "loading": "Chargement...",
        "error": "Erreur",
        "success": "Succès",
        "cancel": "Annuler",
        "confirm": "Confirmer",
        "save": "Enregistrer",
        "delete": "Supprimer",
        "edit": "Modifier",
        "close": "Fermer",
        "back": "Retour",
        "next": "Suivant",
        "submit": "Soumettre",
        "reset": "Réinitialiser",
        "search": "Rechercher",
        "filter": "Filtrer",
        "sort": "Trier",
        "export": "Exporter",
        "import": "Importer",
        "download": "Télécharger",
        "upload": "Téléverser",
        "view": "Voir",
        "copy": "Copier",
        "paste": "Coller",
        "cut": "Couper",
        "selectAll": "Tout sélectionner",
        "deselectAll": "Tout désélectionner",
        "refresh": "Actualiser",
        "reload": "Recharger",
        "retry": "Réessayer",
        "undo": "Annuler",
        "redo": "Refaire",
        "help": "Aide",
        "about": "À propos",
        "settings": "Paramètres",
        "logout": "Déconnexion",
        "login": "Connexion"
    },
    
    # Alerts module
    "alerts": {
        "success": "Opération réussie !",
        "error": "Une erreur s'est produite",
        "warning": "Attention",
        "info": "Information",
        "confirmDelete": "Êtes-vous sûr de vouloir supprimer ?",
        "confirmAction": "Êtes-vous sûr de vouloir continuer ?",
        "unsavedChanges": "Vous avez des modifications non enregistrées",
        "saveSuccess": "Enregistrement réussi",
        "saveFailed": "Échec de l'enregistrement",
        "deleteSuccess": "Suppression réussie",
        "deleteFailed": "Échec de la suppression",
        "updateSuccess": "Mise à jour réussie",
        "updateFailed": "Échec de la mise à jour",
        "loadFailed": "Échec du chargement des données",
        "networkError": "Erreur réseau, veuillez vérifier votre connexion",
        "invalidInput": "Entrée invalide",
        "requiredField": "Ce champ est obligatoire",
        "invalidFormat": "Format invalide",
        "copySuccess": "Copié dans le presse-papiers",
        "copyFailed": "Échec de la copie"
    },
    
    # Hero module
    "hero": {
        "title": "Optimisez vos Prompts LLM avec Promptly",
        "subtitle": "Plateforme professionnelle de test et d'optimisation de prompts alimentée par l'IA",
        "description": "Testez, comparez et optimisez vos prompts LLM avec des flux de travail automatisés et des métriques professionnelles",
        "cta": "Commencer Gratuitement",
        "learnMore": "En Savoir Plus",
        "watchDemo": "Voir la Démo",
        "feature1": "Tests A/B Automatisés",
        "feature2": "Métriques en Temps Réel",
        "feature3": "Support Multi-Modèles",
        "feature4": "Gestion de Version",
        "trustedBy": "Approuvé par",
        "companies": "Plus de 1000 entreprises"
    },
    
    # Dynamic module
    "dynamic": {
        "bestPrompt": "Meilleur Prompt",
        "testCases": "Cas de Test",
        "successRate": "Taux de Réussite",
        "avgTokens": "Tokens Moyens",
        "avgLatency": "Latence Moyenne",
        "totalRuns": "Exécutions Totales",
        "lastRun": "Dernière Exécution",
        "status": "Statut",
        "running": "En cours",
        "completed": "Terminé",
        "failed": "Échoué",
        "pending": "En attente",
        "cancelled": "Annulé",
        "noData": "Aucune donnée disponible",
        "loadingData": "Chargement des données...",
        "refreshData": "Actualiser les données",
        "autoRefresh": "Actualisation automatique",
        "realtime": "Temps réel"
    },
    
    # Glossary module
    "glossary": {
        "title": "Glossaire",
        "prompt": "Prompt",
        "promptDesc": "Instruction d'entrée donnée à un modèle de langage",
        "llm": "LLM (Large Language Model)",
        "llmDesc": "Modèle de langage de grande taille comme GPT, Claude, etc.",
        "token": "Token",
        "tokenDesc": "Unité de texte traitée par les LLM",
        "latency": "Latence",
        "latencyDesc": "Temps de réponse du modèle",
        "temperature": "Température",
        "temperatureDesc": "Contrôle l'aléatoire de la sortie (0-2)",
        "maxTokens": "Tokens Maximum",
        "maxTokensDesc": "Longueur maximale de la réponse",
        "topP": "Top P",
        "topPDesc": "Échantillonnage nucleus pour la diversité",
        "frequencyPenalty": "Pénalité de Fréquence",
        "frequencyPenaltyDesc": "Réduit la répétition de mots (-2 à 2)",
        "presencePenalty": "Pénalité de Présence",
        "presencePenaltyDesc": "Encourage de nouveaux sujets (-2 à 2)",
        "stopSequence": "Séquence d'Arrêt",
        "stopSequenceDesc": "Arrête la génération à des séquences spécifiques",
        "systemPrompt": "Prompt Système",
        "systemPromptDesc": "Instructions de contexte pour le modèle",
        "userPrompt": "Prompt Utilisateur",
        "userPromptDesc": "Requête de l'utilisateur",
        "assistantPrompt": "Prompt Assistant",
        "assistantPromptDesc": "Réponse du modèle",
        "fewShot": "Few-Shot",
        "fewShotDesc": "Apprentissage avec quelques exemples",
        "zeroShot": "Zero-Shot",
        "zeroShotDesc": "Apprentissage sans exemples",
        "chainOfThought": "Chaîne de Pensée",
        "chainOfThoughtDesc": "Raisonnement étape par étape",
        "embedding": "Embedding",
        "embeddingDesc": "Représentation vectorielle du texte",
        "vectorDB": "Base de Données Vectorielle",
        "vectorDBDesc": "Stockage pour la recherche sémantique",
        "rag": "RAG (Retrieval Augmented Generation)",
        "ragDesc": "Génération augmentée par la récupération",
        "fineTuning": "Fine-Tuning",
        "fineTuningDesc": "Entraînement d'un modèle sur des données spécifiques",
        "inference": "Inférence",
        "inferenceDesc": "Génération de réponses par le modèle"
    },
    
    # Test Cases module
    "testCases": {
        "title": "Cas de Test",
        "create": "Créer un Cas de Test",
        "edit": "Modifier le Cas de Test",
        "delete": "Supprimer le Cas de Test",
        "run": "Exécuter le Test",
        "runAll": "Exécuter Tous",
        "stopAll": "Tout Arrêter",
        "name": "Nom",
        "description": "Description",
        "input": "Entrée",
        "expectedOutput": "Sortie Attendue",
        "actualOutput": "Sortie Réelle",
        "result": "Résultat",
        "passed": "Réussi",
        "failed": "Échoué",
        "skipped": "Ignoré",
        "duration": "Durée",
        "createdAt": "Créé le",
        "updatedAt": "Mis à jour le",
        "lastRun": "Dernière Exécution",
        "runCount": "Nombre d'Exécutions",
        "successRate": "Taux de Réussite",
        "avgDuration": "Durée Moyenne",
        "tags": "Tags",
        "priority": "Priorité",
        "high": "Haute",
        "medium": "Moyenne",
        "low": "Basse",
        "category": "Catégorie",
        "functional": "Fonctionnel",
        "performance": "Performance",
        "security": "Sécurité",
        "usability": "Utilisabilité",
        "compatibility": "Compatibilité",
        "regression": "Régression",
        "smoke": "Smoke",
        "integration": "Intégration",
        "unit": "Unitaire",
        "e2e": "Bout en Bout"
    },
    
    # User Guide module
    "userGuide": {
        "title": "Guide Utilisateur",
        "welcome": "Bienvenue sur Promptly",
        "gettingStarted": "Démarrage",
        "quickStart": "Démarrage Rapide",
        "tutorial": "Tutoriel",
        "documentation": "Documentation",
        "faq": "FAQ",
        "support": "Support",
        "contact": "Contact",
        "feedback": "Retour d'Information",
        "reportBug": "Signaler un Bug",
        "featureRequest": "Demande de Fonctionnalité",
        "step1": "Étape 1: Créer un Projet",
        "step1Desc": "Commencez par créer un nouveau projet pour organiser vos prompts",
        "step2": "Étape 2: Ajouter des Prompts",
        "step2Desc": "Ajoutez vos prompts et configurez les paramètres",
        "step3": "Étape 3: Exécuter les Tests",
        "step3Desc": "Exécutez vos tests et analysez les résultats",
        "step4": "Étape 4: Optimiser",
        "step4Desc": "Utilisez les insights pour optimiser vos prompts",
        "tips": "Conseils",
        "tip1": "Utilisez des prompts système clairs et concis",
        "tip2": "Testez plusieurs variantes pour trouver la meilleure",
        "tip3": "Surveillez les métriques de performance",
        "tip4": "Itérez en fonction des résultats",
        "bestPractices": "Meilleures Pratiques",
        "practice1": "Définissez des critères de réussite clairs",
        "practice2": "Utilisez des cas de test diversifiés",
        "practice3": "Versionnez vos prompts",
        "practice4": "Documentez vos décisions",
        "troubleshooting": "Dépannage",
        "issue1": "Le modèle ne répond pas",
        "solution1": "Vérifiez votre connexion API et les limites de taux",
        "issue2": "Résultats incohérents",
        "solution2": "Ajustez la température et ajoutez plus de contexte",
        "issue3": "Réponses lentes",
        "solution3": "Optimisez la longueur du prompt et les tokens max"
    },
    
    # Layer 1 module
    "layer1": {
        "title": "Couche 1: Configuration de Base",
        "model": "Modèle",
        "selectModel": "Sélectionner un Modèle",
        "modelVersion": "Version du Modèle",
        "apiKey": "Clé API",
        "apiEndpoint": "Point de Terminaison API",
        "temperature": "Température",
        "maxTokens": "Tokens Maximum",
        "topP": "Top P",
        "frequencyPenalty": "Pénalité de Fréquence",
        "presencePenalty": "Pénalité de Présence",
        "stopSequence": "Séquence d'Arrêt",
        "timeout": "Délai d'Attente",
        "retries": "Tentatives",
        "systemPrompt": "Prompt Système",
        "systemPromptPlaceholder": "Entrez votre prompt système...",
        "advanced": "Paramètres Avancés",
        "basic": "Paramètres de Base",
        "custom": "Configuration Personnalisée",
        "preset": "Préréglages",
        "creative": "Créatif",
        "balanced": "Équilibré",
        "precise": "Précis",
        "save": "Enregistrer la Configuration",
        "load": "Charger la Configuration",
        "reset": "Réinitialiser par Défaut",
        "validate": "Valider la Configuration",
        "test": "Tester la Configuration"
    },
    
    # Layer 2 module
    "layer2": {
        "title": "Couche 2: Test et Évaluation",
        "testSuite": "Suite de Tests",
        "createTest": "Créer un Test",
        "editTest": "Modifier le Test",
        "deleteTest": "Supprimer le Test",
        "runTest": "Exécuter le Test",
        "runBatch": "Exécution par Lot",
        "schedule": "Planifier",
        "results": "Résultats",
        "metrics": "Métriques",
        "comparison": "Comparaison",
        "baseline": "Référence",
        "variant": "Variante",
        "winner": "Gagnant",
        "confidence": "Confiance",
        "significance": "Signification",
        "sampleSize": "Taille de l'Échantillon",
        "iterations": "Itérations",
        "concurrency": "Concurrence",
        "rateLimit": "Limite de Taux",
        "costEstimate": "Estimation du Coût",
        "timeEstimate": "Estimation du Temps",
        "progress": "Progrès",
        "queue": "File d'Attente",
        "logs": "Journaux",
        "errors": "Erreurs",
        "warnings": "Avertissements",
        "export": "Exporter les Résultats",
        "share": "Partager les Résultats",
        "report": "Générer un Rapport"
    },
    
    # Layer 3 module
    "layer3": {
        "title": "Couche 3: Optimisation et Déploiement",
        "optimize": "Optimiser",
        "autoTune": "Réglage Automatique",
        "suggestions": "Suggestions",
        "improvements": "Améliorations",
        "performance": "Performance",
        "cost": "Coût",
        "quality": "Qualité",
        "speed": "Vitesse",
        "accuracy": "Précision",
        "tradeoffs": "Compromis",
        "deploy": "Déployer",
        "version": "Version",
        "changelog": "Journal des Modifications",
        "rollback": "Annuler",
        "monitor": "Surveiller",
        "alerts": "Alertes",
        "threshold": "Seuil",
        "notification": "Notification",
        "email": "E-mail",
        "webhook": "Webhook",
        "slack": "Slack",
        "dashboard": "Tableau de Bord",
        "analytics": "Analytique",
        "insights": "Insights",
        "trends": "Tendances",
        "forecasts": "Prévisions",
        "recommendations": "Recommandations"
    },
    
    # Pipeline module
    "pipeline": {
        "title": "Pipeline de Workflow",
        "create": "Créer un Pipeline",
        "edit": "Modifier le Pipeline",
        "delete": "Supprimer le Pipeline",
        "run": "Exécuter le Pipeline",
        "stop": "Arrêter le Pipeline",
        "pause": "Mettre en Pause",
        "resume": "Reprendre",
        "status": "Statut",
        "stages": "Étapes",
        "addStage": "Ajouter une Étape",
        "removeStage": "Supprimer l'Étape",
        "configure": "Configurer",
        "dependencies": "Dépendances",
        "parallel": "Parallèle",
        "sequential": "Séquentiel",
        "conditional": "Conditionnel",
        "trigger": "Déclencheur",
        "manual": "Manuel",
        "scheduled": "Planifié",
        "automatic": "Automatique",
        "webhook": "Webhook"
    },
    
    # WhyPromptly module
    "whyPromptly": {
        "title": "Pourquoi Choisir Promptly ?",
        "subtitle": "La plateforme ultime pour l'optimisation des prompts LLM",
        "reason1Title": "Gain de Temps",
        "reason1Desc": "Automatisez les tests et l'optimisation de vos prompts",
        "reason2Title": "Réduction des Coûts",
        "reason2Desc": "Optimisez l'utilisation des tokens et réduisez les coûts API",
        "reason3Title": "Qualité Améliorée",
        "reason3Desc": "Obtenez des résultats cohérents et de haute qualité",
        "reason4Title": "Insights Basés sur les Données",
        "reason4Desc": "Prenez des décisions éclairées avec des métriques détaillées",
        "reason5Title": "Facile à Utiliser",
        "reason5Desc": "Interface intuitive pour tous les niveaux de compétence",
        "reason6Title": "Support d'Entreprise",
        "reason6Desc": "Support dédié et fonctionnalités d'entreprise",
        "cta": "Commencer Aujourd'hui",
        "testimonial1": "Promptly a transformé notre flux de travail LLM",
        "testimonial2": "Économies de coûts incroyables et bien meilleure qualité",
        "testimonial3": "Meilleur outil pour le développement de prompts",
        "stats1": "10x plus rapide",
        "stats2": "50% de réduction des coûts",
        "stats3": "99.9% de disponibilité",
        "stats4": "1000+ utilisateurs satisfaits"
    }
}

# Fonction pour fusionner les traductions
def merge_translations(base, updates):
    result = base.copy() if isinstance(base, dict) else {}
    for key, value in updates.items():
        if key in result and isinstance(result[key], dict) and isinstance(value, dict):
            result[key] = merge_translations(result[key], value)
        else:
            result[key] = value
    return result

# Fusionner les nouvelles traductions
fr_complete = merge_translations(fr, fr_translations)

# Écrire le fichier mis à jour
with open('frontend/locales/fr.json', 'w', encoding='utf-8') as f:
    json.dump(fr_complete, f, ensure_ascii=False, indent=2)

print("✅ Traduction française terminée !")
print(f"📊 Nouvelles clés ajoutées aux modules suivants:")
for module in fr_translations.keys():
    print(f"   - {module}")




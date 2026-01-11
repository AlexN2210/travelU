# Schéma de Base de Données TravelU

Ce document décrit la structure complète de la base de données pour l'application TravelU.

## Tables

### 1. `trips`
Table principale contenant les informations sur les voyages.

| Colonne | Type | Description |
|---------|------|-------------|
| `id` | uuid (PK) | Identifiant unique du voyage |
| `name` | text | Nom du voyage |
| `description` | text (nullable) | Description du voyage |
| `start_date` | date | Date de début du voyage |
| `end_date` | date | Date de fin du voyage |
| `type` | text | Type de voyage : 'single' ou 'roadtrip' |
| `creator_id` | uuid (FK → auth.users) | ID du créateur du voyage |
| `created_at` | timestamptz | Date de création |
| `updated_at` | timestamptz | Date de dernière modification (auto-update) |

### 2. `trip_participants`
Gestion des participants aux voyages et leurs permissions.

| Colonne | Type | Description |
|---------|------|-------------|
| `id` | uuid (PK) | Identifiant unique |
| `trip_id` | uuid (FK → trips) | ID du voyage |
| `user_id` | uuid (FK → auth.users) | ID de l'utilisateur |
| `permission` | text | Permission : 'read' ou 'edit' |
| `joined_at` | timestamptz | Date d'ajout du participant |

**Contrainte unique** : `(trip_id, user_id)` - Un utilisateur ne peut être qu'une fois participant à un voyage.

### 3. `stages`
Étapes d'un road trip ou destination unique.

| Colonne | Type | Description |
|---------|------|-------------|
| `id` | uuid (PK) | Identifiant unique |
| `trip_id` | uuid (FK → trips) | ID du voyage |
| `name` | text | Nom de l'étape |
| `order_index` | integer | Ordre de l'étape |
| `latitude` | numeric | Latitude de l'étape |
| `longitude` | numeric | Longitude de l'étape |
| `accommodation_link` | text (nullable) | Lien vers le logement |
| `transport_to_next` | text (nullable) | Transport vers l'étape suivante |
| `notes` | text (nullable) | Notes sur l'étape |
| `created_at` | timestamptz | Date de création |

### 4. `vote_categories`
Catégories de votes pour un voyage (hébergement, activité, restaurant, etc.).

| Colonne | Type | Description |
|---------|------|-------------|
| `id` | uuid (PK) | Identifiant unique |
| `trip_id` | uuid (FK → trips) | ID du voyage |
| `name` | text | Type de catégorie : 'accommodation', 'activity', 'restaurant', 'other' |
| `title` | text | Titre de la catégorie |
| `created_at` | timestamptz | Date de création |

### 5. `vote_options`
Options de vote dans une catégorie.

| Colonne | Type | Description |
|---------|------|-------------|
| `id` | uuid (PK) | Identifiant unique |
| `category_id` | uuid (FK → vote_categories) | ID de la catégorie |
| `title` | text | Titre de l'option |
| `description` | text (nullable) | Description |
| `link` | text (nullable) | Lien vers l'option (site web, etc.) |
| `added_by` | uuid (FK → auth.users) | ID de l'utilisateur ayant ajouté l'option |
| `created_at` | timestamptz | Date de création |

### 6. `user_votes`
Votes des utilisateurs sur les options.

| Colonne | Type | Description |
|---------|------|-------------|
| `id` | uuid (PK) | Identifiant unique |
| `option_id` | uuid (FK → vote_options) | ID de l'option |
| `user_id` | uuid (FK → auth.users) | ID de l'utilisateur |
| `vote` | boolean | true = like, false = dislike |
| `created_at` | timestamptz | Date du vote |

**Contrainte unique** : `(option_id, user_id)` - Un utilisateur ne peut voter qu'une fois par option.

### 7. `expenses`
Dépenses partagées d'un voyage.

| Colonne | Type | Description |
|---------|------|-------------|
| `id` | uuid (PK) | Identifiant unique |
| `trip_id` | uuid (FK → trips) | ID du voyage |
| `amount` | numeric | Montant de la dépense (>= 0) |
| `category` | text | Catégorie de la dépense |
| `description` | text | Description de la dépense |
| `paid_by` | uuid (FK → auth.users) | ID de l'utilisateur ayant payé |
| `split_between` | jsonb | Tableau JSON des IDs d'utilisateurs entre qui partager |
| `created_at` | timestamptz | Date de création |

### 8. `checklist_items`
Éléments de la checklist d'un voyage.

| Colonne | Type | Description |
|---------|------|-------------|
| `id` | uuid (PK) | Identifiant unique |
| `trip_id` | uuid (FK → trips) | ID du voyage |
| `category` | text | Catégorie : 'clothes', 'health', 'documents', 'accessories', 'activities' |
| `item` | text | Nom de l'élément |
| `is_completed` | boolean | Élément complété ou non |
| `completed_by` | uuid (FK → auth.users, nullable) | ID de l'utilisateur ayant complété |
| `is_auto_generated` | boolean | Généré automatiquement ou ajouté manuellement |
| `created_at` | timestamptz | Date de création |

## Sécurité (RLS - Row Level Security)

Toutes les tables ont RLS activé. Les politiques garantissent que :

- **Trips** : Seuls le créateur et les participants peuvent voir/modifier un voyage
- **Participants** : Seuls le créateur peut gérer les participants
- **Stages** : Participants peuvent voir, éditeurs peuvent modifier
- **Votes** : Tous les participants peuvent créer catégories/options et voter
- **Expenses** : Participants peuvent voir, seul celui qui a payé peut modifier
- **Checklist** : Participants peuvent voir et modifier

## Index

Index créés pour optimiser les performances :

- `trips` : creator_id, dates (start_date, end_date)
- `trip_participants` : user_id, trip_id
- `stages` : trip_id, (trip_id, order_index)
- `vote_categories` : trip_id
- `vote_options` : category_id
- `user_votes` : option_id, user_id
- `expenses` : trip_id, paid_by
- `checklist_items` : trip_id, (trip_id, category)

## Fonctions et Triggers

### Fonction `update_updated_at_column()`
Met à jour automatiquement le champ `updated_at` sur la table `trips` lors d'une modification.

### Trigger `update_trips_updated_at`
Déclenché avant chaque UPDATE sur `trips` pour mettre à jour `updated_at`.

## Relations

```
auth.users (Supabase Auth)
    ↓
    ├── trips (creator_id)
    ├── trip_participants (user_id)
    ├── vote_options (added_by)
    ├── user_votes (user_id)
    ├── expenses (paid_by)
    └── checklist_items (completed_by)

trips
    ↓
    ├── trip_participants (trip_id)
    ├── stages (trip_id)
    ├── vote_categories (trip_id)
    ├── expenses (trip_id)
    └── checklist_items (trip_id)

vote_categories
    ↓
    └── vote_options (category_id)
            ↓
            └── user_votes (option_id)
```

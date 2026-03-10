# schema.org Type Reference

> Catalog of schema.org types evaluated for the ohm ecosystem, organized by adoption tier. See [refactor-plan.md](refactor-plan.md) for how Schedule and ActionStatusType are used in the implementation.

---

## Adoption Tiers

### Tier 1: Adopt via `schema-dts` as typed dependencies

These types are well-scoped, directly useful, and worth importing for compile-time enforcement.

**`Schedule` / `DayOfWeek`** -- Shared recurrence model across ecosystem. Key properties: `repeatFrequency`, `byDay`, `startTime`, `duration`, `exceptDate`, `scheduleTimezone`. See [refactor-plan.md](refactor-plan.md) for `StoredSchedule` design.

**`HowToSupply` / `HowToTool`** -- Ingredient vs. equipment distinction on recipes. `HowToSupply` has `requiredQuantity` (takes `QuantitativeValue` with `value`, `unitCode`, `unitText`) and `estimatedCost`. `HowToTool` is the same shape but semantically reusable equipment -- cast iron, sheet pan, rice cooker, air fryer. Enables filtering recipes by "what I own." Gotcha: `requiredQuantity` is typed as `QuantitativeValue | Text` -- normalize to always store the `QuantitativeValue` shape, fall back to `Text` only for unparseable quantities like "a pinch."

**`ItemList` / `ListItem`** -- Grocery list model. `ItemList` has `itemListElement`, `itemListOrder` (ascending, descending, unordered), `numberOfItems`. Each `ListItem` has `item` (pointing to a `HowToSupply` or `Product`), `position`, `previousItem`/`nextItem`. `itemListOrder` supports ordering by store aisle, by recipe, or alphabetically.

**`NutritionInformation` / `RestrictedDiet`** -- Recipe data model. `RestrictedDiet` enum covers `GlutenFreeDiet`, `VeganDiet`, `DiabeticDiet`, `HalalDiet`, `HinduDiet`, `KosherDiet`, `LowCalorieDiet`, `LowFatDiet`, `LowLactoseDiet`, `LowSaltDiet`, `VegetarianDiet`.

**`HowToStep` / `HowToSection`** -- Structured recipe instructions.

### Tier 2: Reference models -- borrow field names, don't import types

These types are too broad for Dexie storage or have union-type friction, but their field naming conventions are worth aligning with.

**`Product` / `Offer`** -- Grocery/Kroger integration. `Product` has `name`, `brand`, `category`, `sku`, `gtin` (barcode/UPC), `weight`, `nutrition`. `Offer` has `price`, `priceCurrency`, `availability`, `seller`, `validFrom`/`validThrough`. Kroger API maps cleanly: UPC -> `gtin`, price -> `Offer.price`, brand -> `Product.brand`. Don't store full `Product` in Dexie -- define a `GroceryItem` interface that picks specific fields.

**`Action` / `actionStatus`** -- Align ohm's activity states with the four-value enum: `PotentialActionStatus` (Charging), `ActiveActionStatus` (Live), `CompletedActionStatus` (Powered), `FailedActionStatus` (Grounded).

**`CookAction`** -- Has `recipe` field. Models "I cooked this recipe" as a completed action. Useful if recipe companion tracks cook history.

**`ExerciseAction`** -- Has `exerciseCourse`, `diet`, `distance`, `exerciseType`. Maps to Hevy integration.

**`Menu` / `MenuItem`** -- Designed for restaurants, not personal meal planning. Borrow field names like `suitableForDiet` and `menuAddOn` but model meal planning semantics yourself.

**`MonetaryAmount`** -- `value`, `currency`, `minValue`, `maxValue`. Simple enough to define yourself, but aligning field names is free.

**`HowToTip`** -- Sibling to `HowToStep`. Models "pro tip" annotations that don't belong in the step flow. Also applicable to non-recipe HowTo instances (improv exercise cues, workout form notes).

**`PropertyValue`** -- Generic key-value with `propertyID`, `value`, `unitCode`, `minValue`, `maxValue`, `measurementTechnique`. The schema.org escape hatch for structured metadata without a dedicated type. Good reference for shared-schema `Activity` extensions.

**`Course` / `CourseInstance`** -- `Course` has `courseCode`, `coursePrerequisites`, `educationalCredentialAwarded`, `hasCourseInstance`. `CourseInstance` has `courseMode`, `instructor`, `courseSchedule` (takes a `Schedule`). Maps to improv curriculum progression.

**`Game`** -- Has `numberOfPlayers`, `gameItem`, `quest`, `characterAttribute`. Relevant to PF2e companion. `GamePlayMode` enum provides `CoOp`, `MultiPlayer`, `SinglePlayer`.

**`LearningResource`** -- Has `educationalLevel`, `learningResourceType`, `competencyRequired`. Could model improv exercises with skill-level tagging.

**`Rating` / `AggregateRating`** -- `Rating` has `ratingValue`, `bestRating`, `worstRating`, `ratingExplanation`. `AggregateRating` adds `ratingCount`, `reviewCount`. Maps to Letterboxd ratings for movie companion.

**`Review`** -- Has `reviewRating`, `itemReviewed`. Pairs with `Rating` for movie companion.

**`DigitalDocument`** -- Reference for structured metadata on generated PWA outputs.

**`SoftwareApplication`** -- Has `applicationCategory`, `operatingSystem`, `softwareVersion`. Could model the companion app registry.

### Tier 3: Skip entirely

**`FoodEstablishment` / `FoodEvent` / `FoodService`** -- Restaurant/festival-oriented. No personal cooking relevance.

**`Event`** -- Too heavy for personal activity tracking. Designed for public events with `location`, `organizer`, `performer`, `attendee`.

**`Order`** -- Post-purchase model. Wrong for pre-purchase grocery planning.

**`MediaObject` / `ImageObject`** -- Skip unless alt text generator needs structured output format.

---

## `schema-dts` Practical Notes

### Union types

Almost every property is typed as `SomeType | Text | URL`. Strategy: narrow unions at the storage boundary. Use `schema-dts` types for validation when data enters the system, store narrowed interfaces in Dexie.

### `Thing` base properties

Every type inherits `name`, `description`, `url`, `image`, `identifier`, `sameAs`, `alternateName`. Useful ones: `sameAs` for linking a recipe to its source URL, `identifier` for GUID storage, `alternateName` for recipe nicknames.

### `@id` references

schema.org uses `@id` for JSON-LD cross-references. Parallel to but not identical with Dexie GUIDs. Use GUIDs for storage, only generate `@id` URIs if exporting JSON-LD.

### Circular references

Some types reference each other (e.g., `Person.knows` -> `Person`). Handle in Dexie with foreign keys, not nested objects.

### `HowTo` as ecosystem base type

`Recipe` extends `HowTo` extends `CreativeWork`. `HowTo` has `step`, `tool`, `supply`, `totalTime`, `performTime`, `prepTime`, `estimatedCost`, `yield`. Morning routines, improv warm-ups, TTRPG session prep -- all are `HowTo` instances. If a general "routines" companion materializes, `HowTo` is the right base type.

---

## Exploration Prompt

Use this prompt in a new conversation to go deeper on any of the types above:

> I'm building a personal productivity ecosystem called "ohm" -- a kanban-style energy orchestrator with companion PWA apps that push data to it via a shared Dexie/IndexedDB schema layer. I use `schema-dts` (npm) for compile-time TypeScript enforcement of schema.org types.
>
> I've already adopted or evaluated these schema.org types: `Recipe`, `NutritionInformation`, `HowToStep`, `HowToSection`, `HowToSupply`, `HowToTool`, `HowToTip`, `RestrictedDiet`, `Schedule`, `DayOfWeek`, `ItemList`, `ListItem`, `Product`, `Offer`, `Action`, `actionStatus`, `CookAction`, `ExerciseAction`, `PropertyValue`, `Course`, `CourseInstance`, `Game`, `Rating`, `Review`, `MonetaryAmount`, `Menu`, `MenuItem`, `LearningResource`, `DigitalDocument`, `SoftwareApplication`.
>
> Companion apps in the ecosystem include: recipe/grocery planner, workout tracker (Hevy integration), Spanish language practice, improv exercise library, TTRPG (PF2e) character builder, movie tracker (Letterboxd integration), and a voice actor portfolio generator.
>
> I want to explore [SPECIFIC AREA]. For each type you suggest, tell me: (1) what it models and its key properties, (2) where it fits in my stack, and (3) whether it's worth adopting via `schema-dts` or just using as a naming reference.

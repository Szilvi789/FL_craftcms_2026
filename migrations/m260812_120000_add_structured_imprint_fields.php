<?php

declare(strict_types=1);

namespace craft\contentmigrations;

use craft\ckeditor\Field as CkeditorField;
use craft\db\Migration;
use craft\elements\Entry;
use craft\fieldlayoutelements\CustomField;
use craft\fields\Email as EmailField;
use craft\fields\Link as LinkField;
use craft\fields\PlainText as PlainTextField;
use craft\models\FieldLayoutTab;

class m260812_120000_add_structured_imprint_fields extends Migration
{
    public function safeUp(): bool
    {
        $fieldsService = \Craft::$app->getFields();
        $entriesService = \Craft::$app->getEntries();

        $fieldConfigs = [
            'imprintPublisherName' => [
                'class' => PlainTextField::class,
                'name' => 'Media Owner and Publisher',
                'instructions' => 'Enter the operator’s full legal name, including any academic title that is part of the published name.',
                'placeholder' => 'e.g. Mag. art. Firstname Lastname',
            ],
            'imprintAddress' => [
                'class' => PlainTextField::class,
                'name' => 'Business Address',
                'instructions' => 'Enter the complete service address and location of the trade licence. Use a new line for street, postcode/city, and country.',
                'placeholder' => "Street and number\nPostcode City\nAustria",
                'multiline' => true,
                'initialRows' => 3,
            ],
            'imprintPhone' => [
                'class' => PlainTextField::class,
                'name' => 'Telephone',
                'instructions' => 'Use an international format, for example +43 1 234567.',
                'placeholder' => '+43 …',
            ],
            'imprintEmail' => [
                'class' => EmailField::class,
                'name' => 'Email Override',
                'instructions' => 'Optional. Leave this blank to use the Email field from Contact Page Details automatically.',
                'placeholder' => 'Uses the Contact email when empty',
            ],
            'imprintLegalForm' => [
                'class' => PlainTextField::class,
                'name' => 'Legal Form',
                'instructions' => 'Enter the exact legal form, for example Einzelunternehmen. If the business is registered in the Firmenbuch, use its registered legal form.',
                'placeholder' => 'e.g. Einzelunternehmen',
            ],
            'imprintBusinessActivity' => [
                'class' => PlainTextField::class,
                'name' => 'Business Activity / Professional Title',
                'instructions' => 'Enter the official business activity or professional designation, for example Berufsfotografie.',
                'placeholder' => 'e.g. Berufsfotografie',
            ],
            'imprintVatId' => [
                'class' => PlainTextField::class,
                'name' => 'VAT ID (UID)',
                'instructions' => 'Enter the Umsatzsteuer-Identifikationsnummer if one has been issued.',
                'placeholder' => 'e.g. ATU12345678',
            ],
            'imprintProfessionalMembership' => [
                'class' => PlainTextField::class,
                'name' => 'Professional Membership',
                'instructions' => 'Enter the applicable chamber and professional body, for example Wirtschaftskammer Wien, Landesinnung Wien der Berufsfotografie.',
                'placeholder' => 'Wirtschaftskammer …, Landesinnung …',
            ],
            'imprintSupervisoryAuthority' => [
                'class' => PlainTextField::class,
                'name' => 'Supervisory / Trade Authority',
                'instructions' => 'Enter the authority responsible for the trade licence. For a Vienna business, verify the responsible Magistratisches Bezirksamt.',
                'placeholder' => 'e.g. Magistratisches Bezirksamt für den … Bezirk',
            ],
            'imprintDeveloperWebsite' => [
                'class' => LinkField::class,
                'name' => 'Developer Website',
                'instructions' => 'Optional website linked from the fixed credit “Szilvia Varga”.',
                'types' => ['url'],
                'typeSettings' => [
                    'url' => [
                        'allowRootRelativeUrls' => false,
                        'allowAnchors' => false,
                        'allowCustomSchemes' => false,
                    ],
                ],
                'showLabelField' => false,
            ],
        ];

        $imprintFields = [];

        foreach ($fieldConfigs as $handle => $config) {
            $expectedClass = $config['class'];
            unset($config['class']);

            $field = $fieldsService->getFieldByHandle($handle);

            if ($field === null) {
                $field = new $expectedClass([
                    'handle' => $handle,
                    'searchable' => false,
                    'translationMethod' => 'none',
                    ...$config,
                ]);
            } else {
                if (!$field instanceof $expectedClass) {
                    throw new \RuntimeException("The \"$handle\" field already exists but has an unexpected field type.");
                }

                foreach ($config as $property => $value) {
                    $field->$property = $value;
                }
            }

            if (!$fieldsService->saveField($field)) {
                throw new \RuntimeException("Unable to save the \"$handle\" field.");
            }

            $imprintFields[$handle] = $field;
        }

        $copyrightField = $fieldsService->getFieldByHandle('imprintText');

        if (!$copyrightField instanceof CkeditorField) {
            throw new \RuntimeException('The existing "imprintText" CKEditor field must be available before the structured Imprint fields are added.');
        }

        $copyrightField->name = 'Copyright and External Links';
        $copyrightField->instructions = 'Optional editable note shown below the structured Imprint. If empty, a concise copyright/external-links note is used. A general liability disclaimer is not required and does not exclude liability under Austrian law.';

        if (!$fieldsService->saveField($copyrightField)) {
            throw new \RuntimeException('Unable to update the existing "imprintText" field.');
        }

        $imprintFields['imprintText'] = $copyrightField;

        $homepageEntryType = $entriesService->getEntryTypeByHandle('homepage');

        if ($homepageEntryType === null) {
            throw new \RuntimeException('The "homepage" entry type must exist before the Imprint fields can be attached.');
        }

        $fieldLayout = $homepageEntryType->getFieldLayout();
        $tabs = $fieldLayout->getTabs();
        $imprintHandles = array_keys($imprintFields);
        $imprintTab = null;

        foreach ($tabs as $tab) {
            $remainingElements = [];

            foreach ($tab->getElements() as $element) {
                if ($element instanceof CustomField && in_array($element->attribute(), $imprintHandles, true)) {
                    continue;
                }

                $remainingElements[] = $element;
            }

            $tab->setElements($remainingElements);

            if ($tab->name === 'Imprint') {
                $imprintTab = $tab;
            }
        }

        if ($imprintTab === null) {
            $imprintTab = new FieldLayoutTab([
                'name' => 'Imprint',
                'layout' => $fieldLayout,
            ]);
            $tabs[] = $imprintTab;
        }

        $widths = [
            'imprintPublisherName' => 100,
            'imprintAddress' => 100,
            'imprintPhone' => 50,
            'imprintEmail' => 50,
            'imprintLegalForm' => 50,
            'imprintBusinessActivity' => 50,
            'imprintVatId' => 50,
            'imprintProfessionalMembership' => 100,
            'imprintSupervisoryAuthority' => 100,
            'imprintDeveloperWebsite' => 100,
            'imprintText' => 100,
        ];

        $imprintElements = [];

        foreach ($imprintFields as $handle => $field) {
            $imprintElements[] = new CustomField($field, [
                'required' => false,
                'width' => $widths[$handle],
            ]);
        }

        $imprintTab->setElements($imprintElements);
        $fieldLayout->setTabs($tabs);

        if (!$entriesService->saveEntryType($homepageEntryType)) {
            throw new \RuntimeException('Unable to save the Homepage entry type with the structured Imprint tab.');
        }

        $homepageEntry = Entry::find()
            ->section('homepage')
            ->siteId(\Craft::$app->getSites()->getPrimarySite()->id)
            ->status(null)
            ->one();

        if ($homepageEntry !== null) {
            $legacyPlaceholder = 'Imprint details will live here. This can later be replaced with your legal notice, business address, and ownership details.';
            $currentText = trim(strip_tags((string)$homepageEntry->getFieldValue('imprintText')));

            if ($currentText === $legacyPlaceholder) {
                $homepageEntry->setFieldValue('imprintText', null);

                if (!\Craft::$app->getElements()->saveElement($homepageEntry, false, false, false)) {
                    throw new \RuntimeException('Unable to remove the old Imprint placeholder from the Homepage entry.');
                }
            }
        }

        return true;
    }

    public function safeDown(): bool
    {
        echo "m260812_120000_add_structured_imprint_fields cannot be reverted.\n";
        return false;
    }
}

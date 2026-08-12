<?php

declare(strict_types=1);

namespace craft\contentmigrations;

use craft\db\Migration;
use craft\elements\Entry;
use craft\fieldlayoutelements\CustomField;
use craft\fields\Dropdown as DropdownField;
use craft\models\FieldLayoutTab;

class m260812_190000_add_global_typeface_options extends Migration
{
    public function safeUp(): bool
    {
        $fieldsService = \Craft::$app->getFields();
        $entriesService = \Craft::$app->getEntries();

        $fieldConfigs = [
            'displayTypeface' => [
                'name' => 'Display and Navigation Typeface',
                'instructions' => 'Used automatically for the menu, homepage name, loaders, page titles, and major headings. The placement and typography roles stay fixed; this only changes the font family.',
                'options' => [
                    [
                        'label' => 'League Spartan — current, bold geometric',
                        'value' => 'leagueSpartan',
                        'default' => true,
                    ],
                    [
                        'label' => 'Instrument Sans — understated and neutral',
                        'value' => 'instrumentSans',
                        'default' => false,
                    ],
                    [
                        'label' => 'Manrope — contemporary with softer forms',
                        'value' => 'manrope',
                        'default' => false,
                    ],
                ],
            ],
            'bodyTypeface' => [
                'name' => 'Body and Editorial Typeface',
                'instructions' => 'Used automatically for project descriptions, Contact, Info, Imprint, Privacy, forms, and other longer text. The content roles stay fixed; this only changes the font family.',
                'options' => [
                    [
                        'label' => 'Instrument Sans — current, clean editorial',
                        'value' => 'instrumentSans',
                        'default' => true,
                    ],
                    [
                        'label' => 'Source Sans 3 — open and highly readable',
                        'value' => 'sourceSans3',
                        'default' => false,
                    ],
                    [
                        'label' => 'Manrope — compact and contemporary',
                        'value' => 'manrope',
                        'default' => false,
                    ],
                ],
            ],
        ];

        $typefaceFields = [];

        foreach ($fieldConfigs as $handle => $config) {
            $field = $fieldsService->getFieldByHandle($handle);

            if ($field === null) {
                $field = new DropdownField([
                    'handle' => $handle,
                    'searchable' => false,
                    'translationMethod' => 'none',
                    'customOptions' => false,
                    ...$config,
                ]);
            } else {
                if (!$field instanceof DropdownField) {
                    throw new \RuntimeException("The \"$handle\" field already exists but is not a Dropdown field.");
                }

                $field->customOptions = false;

                foreach ($config as $property => $value) {
                    $field->$property = $value;
                }
            }

            if (!$fieldsService->saveField($field)) {
                throw new \RuntimeException("Unable to save the \"$handle\" field.");
            }

            $typefaceFields[$handle] = $field;
        }

        $homepageEntryType = $entriesService->getEntryTypeByHandle('homepage');

        if ($homepageEntryType === null) {
            throw new \RuntimeException('The "homepage" entry type must exist before the General typography fields can be attached.');
        }

        $fieldLayout = $homepageEntryType->getFieldLayout();
        $tabs = $fieldLayout->getTabs();
        $typefaceHandles = array_keys($typefaceFields);
        $generalTab = null;

        foreach ($tabs as $tab) {
            $remainingElements = [];

            foreach ($tab->getElements() as $element) {
                if ($element instanceof CustomField && in_array($element->attribute(), $typefaceHandles, true)) {
                    continue;
                }

                $remainingElements[] = $element;
            }

            $tab->setElements($remainingElements);

            if ($tab->name === 'General') {
                $generalTab = $tab;
            }
        }

        if ($generalTab === null) {
            $generalTab = new FieldLayoutTab([
                'name' => 'General',
                'layout' => $fieldLayout,
            ]);

            $contentTabIndex = null;

            foreach ($tabs as $index => $tab) {
                if ($tab->name === 'Content') {
                    $contentTabIndex = $index;
                    break;
                }
            }

            if ($contentTabIndex === null) {
                $tabs[] = $generalTab;
            } else {
                array_splice($tabs, $contentTabIndex + 1, 0, [$generalTab]);
            }
        }

        $generalTab->setElements([
            new CustomField($typefaceFields['displayTypeface'], [
                'required' => false,
                'width' => 100,
            ]),
            new CustomField($typefaceFields['bodyTypeface'], [
                'required' => false,
                'width' => 100,
            ]),
        ]);

        $fieldLayout->setTabs($tabs);

        if (!$entriesService->saveEntryType($homepageEntryType)) {
            throw new \RuntimeException('Unable to save the Homepage entry type with the General typography fields.');
        }

        $homepageEntry = Entry::find()
            ->section('homepage')
            ->siteId(\Craft::$app->getSites()->getPrimarySite()->id)
            ->status(null)
            ->one();

        if ($homepageEntry !== null) {
            $defaults = [
                'displayTypeface' => 'leagueSpartan',
                'bodyTypeface' => 'instrumentSans',
            ];
            $hasChanges = false;

            foreach ($defaults as $handle => $defaultValue) {
                if ((string)$homepageEntry->getFieldValue($handle) === '') {
                    $homepageEntry->setFieldValue($handle, $defaultValue);
                    $hasChanges = true;
                }
            }

            if ($hasChanges && !\Craft::$app->getElements()->saveElement($homepageEntry, false, false, false)) {
                throw new \RuntimeException('Unable to save the default typeface selections on the Homepage entry.');
            }
        }

        return true;
    }

    public function safeDown(): bool
    {
        echo "m260812_190000_add_global_typeface_options cannot be reverted.\n";
        return false;
    }
}

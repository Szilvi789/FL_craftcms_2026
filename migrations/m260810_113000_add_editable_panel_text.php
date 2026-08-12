<?php

declare(strict_types=1);

namespace craft\contentmigrations;

use craft\ckeditor\Field as CkeditorField;
use craft\db\Migration;
use craft\elements\Entry;
use craft\fieldlayoutelements\CustomField;
use craft\models\FieldLayoutTab;

class m260810_113000_add_editable_panel_text extends Migration
{
    public function safeUp(): bool
    {
        $fieldsService = \Craft::$app->getFields();
        $entriesService = \Craft::$app->getEntries();

        $fieldConfigs = [
            'infoText' => [
                'name' => 'Info',
                'instructions' => 'Formatted text shown when the Info panel is opened.',
            ],
            'imprintText' => [
                'name' => 'Imprint',
                'instructions' => 'Formatted text shown when the Imprint panel is opened.',
            ],
            'privacyText' => [
                'name' => 'Privacy',
                'instructions' => 'Formatted text shown when the Privacy panel is opened.',
            ],
        ];

        $panelFields = [];

        foreach ($fieldConfigs as $handle => $config) {
            $field = $fieldsService->getFieldByHandle($handle);

            if ($field === null) {
                $field = new CkeditorField([
                    'name' => $config['name'],
                    'handle' => $handle,
                    'instructions' => $config['instructions'],
                    'searchable' => false,
                    'translationMethod' => 'none',
                    'toolbar' => [
                        'heading',
                        '|',
                        'bold',
                        'italic',
                        'underline',
                        'link',
                        '|',
                        'bulletedList',
                        'numberedList',
                        '|',
                        'undo',
                        'redo',
                    ],
                    'headingLevels' => [2, 3],
                    'parseEmbeds' => false,
                    'showWordCount' => false,
                ]);

                if (!$fieldsService->saveField($field)) {
                    throw new \RuntimeException("Unable to save the \"$handle\" field.");
                }
            }

            if (!$field instanceof CkeditorField) {
                throw new \RuntimeException("The \"$handle\" field already exists but is not a CKEditor field.");
            }

            $panelFields[$handle] = $field;
        }

        $homepageEntryType = $entriesService->getEntryTypeByHandle('homepage');

        if ($homepageEntryType === null) {
            throw new \RuntimeException('The "homepage" entry type must exist before panel text fields can be attached.');
        }

        $fieldLayout = $homepageEntryType->getFieldLayout();
        $tabs = $fieldLayout->getTabs();
        $panelTab = null;

        foreach ($tabs as $tab) {
            if ($tab->name === 'Panel Text') {
                $panelTab = $tab;
                break;
            }
        }

        if ($panelTab === null) {
            $panelTab = new FieldLayoutTab([
                'name' => 'Panel Text',
                'layout' => $fieldLayout,
            ]);
            $tabs[] = $panelTab;
        }

        $existingHandles = [];

        foreach ($fieldLayout->getCustomFields() as $field) {
            $existingHandles[] = $field->handle;
        }

        $elements = $panelTab->getElements();

        foreach ($panelFields as $handle => $field) {
            if (!in_array($handle, $existingHandles, true)) {
                $elements[] = new CustomField($field, [
                    'required' => false,
                    'width' => 100,
                ]);
            }
        }

        $panelTab->setElements($elements);
        $fieldLayout->setTabs($tabs);

        if (!$entriesService->saveEntryType($homepageEntryType)) {
            throw new \RuntimeException('Unable to save the "homepage" entry type with the panel text fields.');
        }

        $homepageEntry = Entry::find()
            ->section('homepage')
            ->siteId(\Craft::$app->getSites()->getPrimarySite()->id)
            ->status(null)
            ->one();

        if ($homepageEntry !== null) {
            $initialContent = [
                'infoText' => '<p>Lorem Ipsum is simply dummy text of the printing and typesetting industry. Lorem Ipsum has been the industry\'s standard dummy text ever since the 1500s, when an unknown printer took a galley of type and scrambled it to make a type specimen book. It has survived not only five centuries, but also the leap into electronic typesetting, remaining essentially unchanged. It was popularised in the 1960s with the release of Letraset sheets containing Lorem Ipsum passages, and more recently with desktop publishing software like Aldus PageMaker including versions of Lorem Ipsum.</p>',
                'imprintText' => '<p>Imprint details will live here. This can later be replaced with your legal notice, business address, and ownership details.</p>',
                'privacyText' => '<p>Privacy details will live here. This can later be replaced with your data processing, cookie, and GDPR disclosures.</p>',
            ];

            $hasChanges = false;

            foreach ($initialContent as $handle => $content) {
                if (trim(strip_tags((string)$homepageEntry->getFieldValue($handle))) === '') {
                    $homepageEntry->setFieldValue($handle, $content);
                    $hasChanges = true;
                }
            }

            if ($hasChanges && !\Craft::$app->getElements()->saveElement($homepageEntry, false, false, false)) {
                throw new \RuntimeException('Unable to seed the existing panel text into the Homepage entry.');
            }
        }

        return true;
    }

    public function safeDown(): bool
    {
        echo "m260810_113000_add_editable_panel_text cannot be reverted.\n";
        return false;
    }
}

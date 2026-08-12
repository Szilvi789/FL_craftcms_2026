<?php

declare(strict_types=1);

namespace craft\contentmigrations;

use craft\db\Migration;
use craft\elements\Entry;
use craft\fieldlayoutelements\CustomField;
use craft\fields\Assets as AssetsField;
use craft\fields\Color as ColorField;
use craft\models\FieldLayoutTab;

class m260812_210000_add_homepage_background_options extends Migration
{
    public function safeUp(): bool
    {
        $fieldsService = \Craft::$app->getFields();
        $entriesService = \Craft::$app->getEntries();
        $volume = \Craft::$app->getVolumes()->getVolumeByHandle('projectMedia');

        if ($volume === null) {
            throw new \RuntimeException('The "projectMedia" volume must exist before the Homepage background image field can be added.');
        }

        $backgroundColorField = $fieldsService->getFieldByHandle('homepageBackgroundColor');
        $colorConfig = [
            'name' => 'Background Color',
            'instructions' => 'Choose any solid color for the Homepage project canvas. This color remains behind the image and is shown whenever no background image is selected.',
            'allowCustomColors' => true,
            'palette' => [],
        ];

        if ($backgroundColorField === null) {
            $backgroundColorField = new ColorField([
                'handle' => 'homepageBackgroundColor',
                'searchable' => false,
                'translationMethod' => 'none',
                ...$colorConfig,
            ]);
        } else {
            if (!$backgroundColorField instanceof ColorField) {
                throw new \RuntimeException('The "homepageBackgroundColor" field already exists but is not a Color field.');
            }

            foreach ($colorConfig as $property => $value) {
                $backgroundColorField->$property = $value;
            }
        }

        if (!$fieldsService->saveField($backgroundColorField)) {
            throw new \RuntimeException('Unable to save the "homepageBackgroundColor" field.');
        }

        $backgroundImageField = $fieldsService->getFieldByHandle('homepageBackgroundImage');
        $imageConfig = [
            'name' => 'Background Image',
            'instructions' => 'Optional. Select one image for the Homepage project canvas. The image takes priority over the background color; remove it to show the color again.',
            'allowSelfRelations' => false,
            'allowSubfolders' => true,
            'allowUploads' => true,
            'allowedKinds' => ['image'],
            'defaultPlacement' => 'end',
            'defaultUploadLocationSource' => "volume:$volume->uid",
            'maintainHierarchy' => false,
            'maxRelations' => 1,
            'previewMode' => 'full',
            'restrictFiles' => true,
            'restrictLocation' => false,
            'selectionLabel' => 'Add background image',
            'showSearchInput' => true,
            'showSiteMenu' => false,
            'showUnpermittedFiles' => false,
            'showUnpermittedVolumes' => false,
            'sources' => ["volume:$volume->uid"],
            'targetSiteId' => null,
            'validateRelatedElements' => false,
            'viewMode' => 'cards',
        ];

        if ($backgroundImageField === null) {
            $backgroundImageField = new AssetsField([
                'handle' => 'homepageBackgroundImage',
                'searchable' => false,
                'translationMethod' => 'none',
                ...$imageConfig,
            ]);
        } else {
            if (!$backgroundImageField instanceof AssetsField) {
                throw new \RuntimeException('The "homepageBackgroundImage" field already exists but is not an Assets field.');
            }

            foreach ($imageConfig as $property => $value) {
                $backgroundImageField->$property = $value;
            }
        }

        if (!$fieldsService->saveField($backgroundImageField)) {
            throw new \RuntimeException('Unable to save the "homepageBackgroundImage" field.');
        }

        $legacyColorField = $fieldsService->getFieldByHandle('hexcolour');
        $homepageEntry = Entry::find()
            ->section('homepage')
            ->siteId(\Craft::$app->getSites()->getPrimarySite()->id)
            ->status(null)
            ->one();
        $legacyColor = $homepageEntry && $legacyColorField
            ? trim((string)$homepageEntry->getFieldValue('hexcolour'))
            : '';

        if ($legacyColor !== '' && !str_starts_with($legacyColor, '#')) {
            $legacyColor = "#$legacyColor";
        }

        if (!preg_match('/^#[0-9A-Fa-f]{6}$/', $legacyColor)) {
            $legacyColor = '#000000';
        }

        $homepageEntryType = $entriesService->getEntryTypeByHandle('homepage');

        if ($homepageEntryType === null) {
            throw new \RuntimeException('The "homepage" entry type must exist before the background fields can be attached.');
        }

        $fieldLayout = $homepageEntryType->getFieldLayout();
        $tabs = $fieldLayout->getTabs();
        $backgroundHandles = ['hexcolour', 'homepageBackgroundColor', 'homepageBackgroundImage'];
        $appearanceTab = null;
        $updatedTabs = [];

        foreach ($tabs as $tab) {
            $remainingElements = [];

            foreach ($tab->getElements() as $element) {
                if ($element instanceof CustomField && in_array($element->attribute(), $backgroundHandles, true)) {
                    continue;
                }

                $remainingElements[] = $element;
            }

            $tab->setElements($remainingElements);

            if ($tab->name === 'Appearance') {
                $appearanceTab = $tab;
            }

            if ($tab->name !== 'Content' || $remainingElements !== []) {
                $updatedTabs[] = $tab;
            }
        }

        if ($appearanceTab === null) {
            $appearanceTab = new FieldLayoutTab([
                'name' => 'Appearance',
                'layout' => $fieldLayout,
            ]);

            $generalTabIndex = null;

            foreach ($updatedTabs as $index => $tab) {
                if ($tab->name === 'General') {
                    $generalTabIndex = $index;
                    break;
                }
            }

            if ($generalTabIndex === null) {
                $updatedTabs[] = $appearanceTab;
            } else {
                array_splice($updatedTabs, $generalTabIndex, 0, [$appearanceTab]);
            }
        }

        $appearanceElements = $appearanceTab->getElements();
        $appearanceTab->setElements([
            ...$appearanceElements,
            new CustomField($backgroundColorField, [
                'required' => false,
                'width' => 50,
            ]),
            new CustomField($backgroundImageField, [
                'required' => false,
                'width' => 50,
            ]),
        ]);

        $fieldLayout->setTabs($updatedTabs);

        if (!$entriesService->saveEntryType($homepageEntryType)) {
            throw new \RuntimeException('Unable to save the Homepage entry type with the Appearance fields.');
        }

        if ($homepageEntry !== null && (string)$homepageEntry->getFieldValue('homepageBackgroundColor') === '') {
            $homepageEntry->setFieldValue('homepageBackgroundColor', $legacyColor);

            if (!\Craft::$app->getElements()->saveElement($homepageEntry, false, false, false)) {
                throw new \RuntimeException('Unable to preserve the existing Homepage background color.');
            }
        }

        if ($legacyColorField !== null && !$fieldsService->deleteField($legacyColorField)) {
            throw new \RuntimeException('Unable to remove the superseded "hexcolour" field.');
        }

        return true;
    }

    public function safeDown(): bool
    {
        echo "m260812_210000_add_homepage_background_options cannot be reverted.\n";
        return false;
    }
}

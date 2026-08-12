<?php

declare(strict_types=1);

namespace craft\contentmigrations;

use craft\ckeditor\Field as CkeditorField;
use craft\db\Migration;
use craft\elements\Asset;
use craft\elements\Entry;
use craft\fieldlayoutelements\CustomField;
use craft\fields\Assets as AssetsField;
use craft\models\FieldLayoutTab;

class m260812_170000_add_structured_info_fields extends Migration
{
    public function safeUp(): bool
    {
        $fieldsService = \Craft::$app->getFields();
        $entriesService = \Craft::$app->getEntries();
        $volume = \Craft::$app->getVolumes()->getVolumeByHandle('projectMedia');

        if ($volume === null) {
            throw new \RuntimeException('The "projectMedia" volume must exist before the Info image field can be added.');
        }

        $infoTextField = $fieldsService->getFieldByHandle('infoText');

        if (!$infoTextField instanceof CkeditorField) {
            throw new \RuntimeException('The existing "infoText" CKEditor field must be available before the structured Info fields are added.');
        }

        $infoTextField->name = 'Info Text';
        $infoTextField->instructions = 'Add and format the biography, selected clients or publications, contact details, and links shown in the Info panel.';

        if (!$fieldsService->saveField($infoTextField)) {
            throw new \RuntimeException('Unable to update the existing "infoText" field.');
        }

        $infoImageField = $fieldsService->getFieldByHandle('infoImage');

        $imageConfig = [
            'name' => 'Info Image',
            'instructions' => 'Optional. Select one image to display beside the Info text. Remove it to show a text-only layout. Set meaningful Alt Text on the selected asset when the image conveys information.',
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
            'selectionLabel' => 'Add Info image',
            'showSearchInput' => true,
            'showSiteMenu' => false,
            'showUnpermittedFiles' => false,
            'showUnpermittedVolumes' => false,
            'sources' => ["volume:$volume->uid"],
            'targetSiteId' => null,
            'validateRelatedElements' => false,
            'viewMode' => 'cards',
        ];

        if ($infoImageField === null) {
            $infoImageField = new AssetsField([
                'handle' => 'infoImage',
                'searchable' => false,
                'translationMethod' => 'none',
                ...$imageConfig,
            ]);
        } else {
            if (!$infoImageField instanceof AssetsField) {
                throw new \RuntimeException('The "infoImage" field already exists but is not an Assets field.');
            }

            foreach ($imageConfig as $property => $value) {
                $infoImageField->$property = $value;
            }
        }

        if (!$fieldsService->saveField($infoImageField)) {
            throw new \RuntimeException('Unable to save the "infoImage" field.');
        }

        $homepageEntryType = $entriesService->getEntryTypeByHandle('homepage');

        if ($homepageEntryType === null) {
            throw new \RuntimeException('The "homepage" entry type must exist before the Info fields can be attached.');
        }

        $fieldLayout = $homepageEntryType->getFieldLayout();
        $tabs = $fieldLayout->getTabs();
        $infoHandles = ['infoText', 'infoImage'];
        $infoTab = null;
        $updatedTabs = [];

        foreach ($tabs as $tab) {
            $remainingElements = [];

            foreach ($tab->getElements() as $element) {
                if ($element instanceof CustomField && in_array($element->attribute(), $infoHandles, true)) {
                    continue;
                }

                $remainingElements[] = $element;
            }

            $tab->setElements($remainingElements);

            if ($tab->name === 'Info') {
                $infoTab = $tab;
            }

            if ($tab->name !== 'Panel Text' || $remainingElements !== []) {
                $updatedTabs[] = $tab;
            }
        }

        if ($infoTab === null) {
            $infoTab = new FieldLayoutTab([
                'name' => 'Info',
                'layout' => $fieldLayout,
            ]);
            $updatedTabs[] = $infoTab;
        }

        $infoTab->setElements([
            new CustomField($infoTextField, [
                'required' => false,
                'width' => 100,
            ]),
            new CustomField($infoImageField, [
                'required' => false,
                'width' => 100,
            ]),
        ]);

        $fieldLayout->setTabs($updatedTabs);

        if (!$entriesService->saveEntryType($homepageEntryType)) {
            throw new \RuntimeException('Unable to save the Homepage entry type with the structured Info tab.');
        }

        $homepageEntry = Entry::find()
            ->section('homepage')
            ->siteId(\Craft::$app->getSites()->getPrimarySite()->id)
            ->status(null)
            ->one();

        if ($homepageEntry !== null) {
            $legacyPlaceholder = "Lorem Ipsum is simply dummy text of the printing and typesetting industry. Lorem Ipsum has been the industry's standard dummy text ever since the 1500s, when an unknown printer took a galley of type and scrambled it to make a type specimen book. It has survived not only five centuries, but also the leap into electronic typesetting, remaining essentially unchanged. It was popularised in the 1960s with the release of Letraset sheets containing Lorem Ipsum passages, and more recently with desktop publishing software like Aldus PageMaker including versions of Lorem Ipsum.";
            $currentText = trim(strip_tags((string)$homepageEntry->getFieldValue('infoText')));
            $hasChanges = false;

            if ($currentText === '' || $currentText === $legacyPlaceholder) {
                $homepageEntry->setFieldValue('infoText', '<p><strong>Example biography — replace before publication.</strong></p><p>Write a concise introduction to Florian Lechner’s photographic practice here. Two or three short paragraphs work especially well in this layout.</p><p>Add selected publications, commissions, exhibitions, representation, or licensing information in a second paragraph.</p><p><a href="/contact">Contact Florian Lechner</a></p>');
                $hasChanges = true;
            }

            if ($homepageEntry->getFieldValue('infoImage')->one() === null) {
                $exampleImage = Asset::find()
                    ->volume('projectMedia')
                    ->filename('unbenannt-2315.jpg')
                    ->kind('image')
                    ->one();

                if ($exampleImage !== null) {
                    $homepageEntry->setFieldValue('infoImage', [$exampleImage->id]);
                    $hasChanges = true;
                }
            }

            if ($hasChanges && !\Craft::$app->getElements()->saveElement($homepageEntry, false, false, false)) {
                throw new \RuntimeException('Unable to seed the example Info content into the Homepage entry.');
            }
        }

        return true;
    }

    public function safeDown(): bool
    {
        echo "m260812_170000_add_structured_info_fields cannot be reverted.\n";
        return false;
    }
}

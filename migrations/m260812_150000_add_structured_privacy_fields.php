<?php

declare(strict_types=1);

namespace craft\contentmigrations;

use craft\ckeditor\Field as CkeditorField;
use craft\db\Migration;
use craft\elements\Entry;
use craft\fieldlayoutelements\CustomField;
use craft\fields\Date as DateField;
use craft\fields\Email as EmailField;
use craft\fields\PlainText as PlainTextField;
use craft\models\FieldLayoutTab;

class m260812_150000_add_structured_privacy_fields extends Migration
{
    public function safeUp(): bool
    {
        $fieldsService = \Craft::$app->getFields();
        $entriesService = \Craft::$app->getEntries();

        $fieldConfigs = [
            'privacyEmail' => [
                'class' => EmailField::class,
                'name' => 'Privacy Contact Email Override',
                'instructions' => 'Optional. Leave this blank to use the Email field from Contact Page Details automatically.',
                'placeholder' => 'Uses the Contact email when empty',
            ],
            'privacyTlsText' => [
                'class' => CkeditorField::class,
                'name' => 'Encrypted Data Transmission',
                'instructions' => 'Editable explanation of HTTPS/TLS transport encryption. The section heading is added automatically.',
            ],
            'privacyServerLogsText' => [
                'class' => CkeditorField::class,
                'name' => 'Web Server Log Files',
                'instructions' => 'Describe the access data actually recorded by the production host, its purpose, legal basis, and recipients. Confirm the details with the hosting provider before publication.',
            ],
            'privacyLogRetention' => [
                'class' => PlainTextField::class,
                'name' => 'Log Retention Period',
                'instructions' => 'Enter the production host’s verified deletion period. This value is inserted into the Web Server Log Files section.',
                'placeholder' => 'e.g. 30 days',
            ],
            'privacyCookiesText' => [
                'class' => CkeditorField::class,
                'name' => 'Cookies',
                'instructions' => 'Describe cookies and similar technologies actually used by the website. The supplied example reflects the current Craft contact form and no analytics or marketing cookies.',
            ],
            'privacyContactText' => [
                'class' => CkeditorField::class,
                'name' => 'Contact Requests',
                'instructions' => 'Describe how name, email, optional telephone number, and message are used when someone submits the contact form.',
            ],
            'privacyInquiryRetention' => [
                'class' => PlainTextField::class,
                'name' => 'Contact Request Retention',
                'instructions' => 'State when contact correspondence is deleted. This value is inserted into the Contact Requests section.',
                'placeholder' => 'e.g. after the request is resolved, subject to legal retention duties',
                'multiline' => true,
                'initialRows' => 2,
            ],
            'privacyCdnText' => [
                'class' => CkeditorField::class,
                'name' => 'External Content Delivery (jsDelivr)',
                'instructions' => 'The current site loads Barba.js from jsDelivr. Keep this disclosure accurate if that dependency or provider changes; clear the field only after the external request has been removed.',
            ],
            'privacyRightsText' => [
                'class' => CkeditorField::class,
                'name' => 'Your Data Protection Rights',
                'instructions' => 'Editable summary of GDPR rights. The fixed Austrian Data Protection Authority link is added automatically.',
            ],
            'privacyLastUpdated' => [
                'class' => DateField::class,
                'name' => 'Privacy Policy Last Updated',
                'instructions' => 'Date shown at the end of the Privacy Policy. Update it whenever the policy or the website’s data processing changes.',
                'showDate' => true,
                'showTime' => false,
                'showTimeZone' => false,
            ],
        ];

        $privacyFields = [];

        foreach ($fieldConfigs as $handle => $config) {
            $expectedClass = $config['class'];
            unset($config['class']);

            if ($expectedClass === CkeditorField::class) {
                $config = [
                    ...$config,
                    'toolbar' => [
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
                    'headingLevels' => [],
                    'parseEmbeds' => false,
                    'showWordCount' => false,
                ];
            }

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

            $privacyFields[$handle] = $field;
        }

        $additionalField = $fieldsService->getFieldByHandle('privacyText');

        if (!$additionalField instanceof CkeditorField) {
            throw new \RuntimeException('The existing "privacyText" CKEditor field must be available before the structured Privacy fields are added.');
        }

        $additionalField->name = 'Additional Privacy Information';
        $additionalField->instructions = 'Optional additional information shown before the rights section. Leave blank when no further processing activity needs to be described.';

        if (!$fieldsService->saveField($additionalField)) {
            throw new \RuntimeException('Unable to update the existing "privacyText" field.');
        }

        $privacyFields['privacyText'] = $additionalField;

        $homepageEntryType = $entriesService->getEntryTypeByHandle('homepage');

        if ($homepageEntryType === null) {
            throw new \RuntimeException('The "homepage" entry type must exist before the Privacy fields can be attached.');
        }

        $fieldLayout = $homepageEntryType->getFieldLayout();
        $tabs = $fieldLayout->getTabs();
        $privacyHandles = array_keys($privacyFields);
        $privacyTab = null;

        foreach ($tabs as $tab) {
            $remainingElements = [];

            foreach ($tab->getElements() as $element) {
                if ($element instanceof CustomField && in_array($element->attribute(), $privacyHandles, true)) {
                    continue;
                }

                $remainingElements[] = $element;
            }

            $tab->setElements($remainingElements);

            if ($tab->name === 'Privacy') {
                $privacyTab = $tab;
            }
        }

        if ($privacyTab === null) {
            $privacyTab = new FieldLayoutTab([
                'name' => 'Privacy',
                'layout' => $fieldLayout,
            ]);
            $tabs[] = $privacyTab;
        }

        $widths = [
            'privacyEmail' => 100,
            'privacyTlsText' => 100,
            'privacyServerLogsText' => 100,
            'privacyLogRetention' => 100,
            'privacyCookiesText' => 100,
            'privacyContactText' => 100,
            'privacyInquiryRetention' => 100,
            'privacyCdnText' => 100,
            'privacyRightsText' => 100,
            'privacyLastUpdated' => 100,
            'privacyText' => 100,
        ];

        $privacyElements = [];

        foreach ($privacyFields as $handle => $field) {
            $privacyElements[] = new CustomField($field, [
                'required' => false,
                'width' => $widths[$handle],
            ]);
        }

        $privacyTab->setElements($privacyElements);
        $fieldLayout->setTabs($tabs);

        if (!$entriesService->saveEntryType($homepageEntryType)) {
            throw new \RuntimeException('Unable to save the Homepage entry type with the structured Privacy tab.');
        }

        $homepageEntry = Entry::find()
            ->section('homepage')
            ->siteId(\Craft::$app->getSites()->getPrimarySite()->id)
            ->status(null)
            ->one();

        if ($homepageEntry !== null) {
            $legacyPlaceholder = 'Privacy details will live here. This can later be replaced with your data processing, cookie, and GDPR disclosures.';
            $initialContent = [
                'privacyEmail' => 'mail@florianlechner.at',
                'privacyTlsText' => '<p>This website is delivered via HTTPS and uses TLS encryption. This protects data transmitted between your browser and the web server against unauthorised access while it is in transit.</p>',
                'privacyServerLogsText' => '<p>When you visit this website, the hosting server may automatically record technical access data, including the requested address (URL), date and time of access, amount of data transferred, referring page, browser and version, operating system, and IP address.</p><p>This data is processed to deliver the website reliably, maintain technical security, investigate faults or misuse, and protect legal claims. The legal basis is our legitimate interest under Article 6(1)(f) GDPR. Hosting and technical service providers may receive this data as processors.</p>',
                'privacyLogRetention' => '30 days',
                'privacyCookiesText' => '<p>No analytics or marketing cookies are used. When the Contact page is opened, Craft CMS sets technically necessary session cookies for the secure operation of the form and protection against forged requests (CraftSessionId and CRAFT_CSRF_TOKEN). They are session cookies and are deleted when the browser session ends.</p><p>These cookies are necessary to provide the expressly requested website and contact-form functions. They are used on the basis of Section 165(3) TKG 2021 and, where personal data is involved, Article 6(1)(f) GDPR.</p>',
                'privacyContactText' => '<p>If you contact us through the form or by email, we process your name, email address, optional telephone number, message, and related correspondence to answer your request and, where applicable, take steps before entering into a contract.</p><p>The legal basis is Article 6(1)(b) GDPR for contract-related enquiries and otherwise our legitimate interest in responding to enquiries under Article 6(1)(f) GDPR. Form submissions are sent by email and are not stored as separate submissions in Craft CMS. Email, hosting, and technical service providers may process the correspondence on our behalf.</p>',
                'privacyInquiryRetention' => 'when the request has been conclusively resolved, unless legal retention duties or the establishment, exercise, or defence of legal claims require longer storage',
                'privacyCdnText' => '<p>This website loads the Barba.js navigation library from the jsDelivr content delivery network, operated by Volentio JSD Limited, United Kingdom. When the library is requested, your IP address and technical request information are transmitted to jsDelivr and its network providers so the file can be delivered securely and efficiently.</p><p>The legal basis is our legitimate interest in reliable and efficient website delivery under Article 6(1)(f) GDPR. jsDelivr uses a global network; where data is transferred outside the European Economic Area, the provider states that applicable adequacy decisions or standard contractual clauses are used.</p>',
                'privacyRightsText' => '<p>Subject to the applicable legal requirements, you have rights of access, rectification, erasure, restriction of processing, data portability, and objection to processing based on legitimate interests. You may also lodge a complaint with a data protection supervisory authority.</p><p>To exercise your rights or ask a privacy question, contact us using the email address shown above. Correspondence is treated confidentially.</p>',
                'privacyLastUpdated' => new \DateTime('2026-08-12 12:00:00', new \DateTimeZone(\Craft::$app->getTimeZone())),
                'privacyText' => '<p>We do not use personal data from this website for automated decision-making or profiling.</p>',
            ];

            $hasChanges = false;

            foreach ($initialContent as $handle => $content) {
                $currentValue = $homepageEntry->getFieldValue($handle);
                $currentText = $currentValue instanceof \DateTimeInterface
                    ? $currentValue->format('Y-m-d')
                    : trim(strip_tags((string)$currentValue));

                if ($currentText === '' || ($handle === 'privacyText' && $currentText === $legacyPlaceholder)) {
                    $homepageEntry->setFieldValue($handle, $content);
                    $hasChanges = true;
                }
            }

            if ($hasChanges && !\Craft::$app->getElements()->saveElement($homepageEntry, false, false, false)) {
                throw new \RuntimeException('Unable to seed the structured Privacy content into the Homepage entry.');
            }
        }

        return true;
    }

    public function safeDown(): bool
    {
        echo "m260812_150000_add_structured_privacy_fields cannot be reverted.\n";
        return false;
    }
}

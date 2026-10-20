import React, { useState } from 'react';
import {
  Github,
  Monitor,
  Smartphone,
  Terminal,
  Copy,
  Check,
  X,
  Scale,
  User
} from 'lucide-react';
import { useLanguage } from '../../context/LanguageContext';
import { AppVersion } from '../common/AppVersion';
import { QuriosoIcon } from '../common/QuriosoLogo';

interface MultiplatformGuideProps {
  onClose: () => void;
}

export const MultiplatformGuide: React.FC<MultiplatformGuideProps> = ({ onClose }) => {
  const { t } = useLanguage();
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'overview' | 'android' | 'desktop' | 'github'>('overview');

  const copyCode = (text: string, id: string) => {
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(text).then(() => {
        setCopiedId(id);
        setTimeout(() => setCopiedId(null), 2000);
      });
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-petrolio/15 backdrop-blur-md p-4">
      <div className="w-full max-w-3xl max-h-[90vh] rounded-3xl bg-white border border-line shadow-lg flex flex-col overflow-hidden text-ink">
        {/* Header with Qurioso Q Icon */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-line bg-white">
          <div className="flex items-center gap-3">
            <QuriosoIcon size={40} variant="rounded" />
            <div>
              <h2 className="text-lg font-bold text-ink flex items-center gap-2">
                <span>{t.guideTitle}</span><AppVersion />
              </h2>
              <p className="text-xs text-muted">
                {t.guideSubtitle}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-xl hover:bg-surface-hover text-muted hover:text-ink transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation Tabs */}
        <div className="flex items-center gap-2 px-6 py-3 bg-white border-b border-line text-xs overflow-x-auto">
          {[
            { id: 'overview', label: t.tabOverview, icon: Github },
            { id: 'android', label: t.tabAndroid, icon: Smartphone },
            { id: 'desktop', label: t.tabDesktop, icon: Monitor },
            { id: 'github', label: t.tabGitHub, icon: Terminal },
          ].map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as typeof activeTab)}
                className={`flex items-center gap-2 px-3.5 py-2 rounded-xl font-semibold transition whitespace-nowrap cursor-pointer ${
                  activeTab === tab.id
                    ? 'bg-petrolio text-white shadow-sm border border-line'
                    : 'bg-surface-soft text-muted hover:text-muted'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* Tab Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-5 text-sm">
          {/* TAB 1: OVERVIEW */}
          {activeTab === 'overview' && (
            <div className="space-y-4">
              <div className="p-4 rounded-2xl bg-petrolio/20 border border-line text-petrolio text-xs leading-relaxed">
                <strong className="text-ink block mb-1">{t.readyForGitHub}</strong>
                {t.appDescription}
              </div>

              {/* Author & License Info Badge */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="p-3.5 rounded-xl bg-surface-soft border border-line flex items-start gap-3">
                  <User className="w-4 h-4 text-accent-ink mt-0.5 shrink-0" />
                  <div className="text-xs">
                    <span className="font-bold text-ink block">Autore / Author:</span>
                    <span className="text-muted">Maurizio Napolitano</span>
                    <a
                      href="mailto:maurizio.napolitano@gmail.com"
                      className="text-accent-ink hover:underline block text-[11px]"
                    >
                      maurizio.napolitano@gmail.com
                    </a>
                  </div>
                </div>

                <div className="p-3.5 rounded-xl bg-surface-soft border border-line flex items-start gap-3">
                  <Scale className="w-4 h-4 text-emerald-700 mt-0.5 shrink-0" />
                  <div className="text-xs">
                    <span className="font-bold text-ink block">Licenza / License:</span>
                    <span className="text-muted">GNU Affero General Public License v3</span>
                    <span className="text-emerald-700 font-mono text-[11px] block">(AGPL-3.0-or-later)</span>
                  </div>
                </div>
              </div>

              <div>
                <h4 className="font-bold text-ink text-sm mb-2">{t.initGitTitle}</h4>
                <div className="relative">
                  <pre className="bg-white p-3.5 rounded-xl border border-line font-mono text-xs text-muted overflow-x-auto">
{`git init
git add .
git commit -m "feat: initial commit of Qurioso"
git branch -M main
git remote add origin https://github.com/TUO-USERNAME/qurioso.git
git push -u origin main`}
                  </pre>
                  <button
                    onClick={() => copyCode(`git init\ngit add .\ngit commit -m "feat: initial commit of Qurioso"\ngit branch -M main\ngit remote add origin https://github.com/TUO-USERNAME/qurioso.git\ngit push -u origin main`, 'git-init')}
                    className="absolute top-2.5 right-2.5 p-1.5 rounded-lg bg-surface-soft hover:bg-surface-hover text-muted transition cursor-pointer"
                  >
                    {copiedId === 'git-init' ? <Check className="w-3.5 h-3.5 text-emerald-700" /> : <Copy className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>

              {/* Automatic server port */}
              <div className="p-4 rounded-2xl bg-surface-soft border border-line text-xs">
                <div className="flex items-center gap-2 text-ink font-bold mb-1">
                  <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
                  <span>Server HTTP / WebSocket su porta libera automatica</span>
                </div>
                <p className="text-muted mb-2 leading-relaxed">
                  A ogni avvio Qurioso sceglie una porta libera. L’indirizzo effettivo appare nel terminale e nel QR Code: i partecipanti devono essere sulla stessa rete Wi-Fi, con connessioni tra dispositivi consentite. Puoi fissare una porta con la variabile <code>PORT</code>.
                </p>
                <pre className="bg-surface-soft p-2.5 rounded-lg border border-line font-mono text-[11px] text-petrolio">
PORT=4444 npm start
                </pre>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2">
                <div className="p-4 rounded-2xl bg-surface-soft border border-line">
                  <div className="flex items-center gap-2 font-bold text-ink text-xs mb-1">
                    <Smartphone className="w-4 h-4 text-emerald-700" />
                    {t.mobileCardTitle}
                  </div>
                  <p className="text-xs text-muted">
                    {t.mobileCardDesc}
                  </p>
                </div>

                <div className="p-4 rounded-2xl bg-surface-soft border border-line">
                  <div className="flex items-center gap-2 font-bold text-ink text-xs mb-1">
                    <Monitor className="w-4 h-4 text-petrolio" />
                    {t.desktopCardTitle}
                  </div>
                  <p className="text-xs text-muted">
                    {t.desktopCardDesc}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: ANDROID */}
          {activeTab === 'android' && (
            <div className="space-y-4">
              <h4 className="font-bold text-ink text-sm">{t.androidGuideTitle}</h4>
              <p className="text-xs text-muted">
                {t.androidGuideDesc}
              </p>

              <div className="relative">
                <pre className="bg-white p-3.5 rounded-xl border border-line font-mono text-xs text-muted overflow-x-auto">
{`# 1. Compila i file statici di produzione
npm run build

# 2. Installa le dipendenze di Capacitor per Android
npm install @capacitor/core @capacitor/android
npx cap add android

# 3. Sincronizza la cartella dist con il modulo Android nativo
npx cap sync android

# 4. Apri in Android Studio per generare l'APK o l'AAB firmato
npx cap open android`}
                </pre>
                <button
                  onClick={() => copyCode(`npm run build\nnpm install @capacitor/core @capacitor/android\nnpx cap add android\nnpx cap sync android\nnpx cap open android`, 'cap-android')}
                  className="absolute top-2.5 right-2.5 p-1.5 rounded-lg bg-surface-soft hover:bg-surface-hover text-muted transition cursor-pointer"
                >
                  {copiedId === 'cap-android' ? <Check className="w-3.5 h-3.5 text-emerald-700" /> : <Copy className="w-3.5 h-3.5" />}
                </button>
              </div>

              <div className="p-3.5 rounded-xl bg-surface-soft border border-line text-xs text-muted">
                💡 <strong>{t.twaHint}</strong>
              </div>
            </div>
          )}

          {/* TAB 3: DESKTOP */}
          {activeTab === 'desktop' && (
            <div className="space-y-4">
              <h4 className="font-bold text-ink text-sm">{t.desktopGuideTitle}</h4>
              <p className="text-xs text-muted">
                {t.desktopGuideDesc}
              </p>

              <div className="relative">
                <pre className="bg-white p-3.5 rounded-xl border border-line font-mono text-xs text-muted overflow-x-auto">
{`# Installa electron e electron-builder
npm install --save-dev electron electron-builder

# Compila l'applicazione web
npm run build

# Per Linux (genera .deb e .AppImage)
npx electron-builder --linux deb AppImage

# Per Windows (genera Setup.exe / NSIS)
npx electron-builder --win nsis

# Per macOS (genera .dmg)
npx electron-builder --mac dmg`}
                </pre>
                <button
                  onClick={() => copyCode(`npm install --save-dev electron electron-builder\nnpm run build\nnpx electron-builder --linux deb AppImage\nnpx electron-builder --win nsis\nnpx electron-builder --mac dmg`, 'electron-build')}
                  className="absolute top-2.5 right-2.5 p-1.5 rounded-lg bg-surface-soft hover:bg-surface-hover text-muted transition cursor-pointer"
                >
                  {copiedId === 'electron-build' ? <Check className="w-3.5 h-3.5 text-emerald-700" /> : <Copy className="w-3.5 h-3.5" />}
                </button>
              </div>
            </div>
          )}

          {/* TAB 4: GITHUB ACTIONS */}
          {activeTab === 'github' && (
            <div className="space-y-4">
              <h4 className="font-bold text-ink text-sm">{t.githubActionsTitle}</h4>
              <p className="text-xs text-muted">
                {t.githubActionsDesc}
              </p>

              <div className="relative">
                <pre className="bg-white p-3.5 rounded-xl border border-line font-mono text-[11px] text-muted overflow-x-auto max-h-56">
{`name: Multiplatform Build CI
on:
  push:
    branches: [ main ]
    tags: [ 'v*' ]

jobs:
  build-web:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
      - run: npm ci
      - run: npm run build
      - uses: actions/upload-artifact@v4
        with:
          name: web-dist
          path: dist/`}
                </pre>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3.5 bg-white border-t border-line flex justify-end">
          <button
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-petrolio hover:bg-petrolio text-xs font-bold text-white transition cursor-pointer"
          >
            {t.understandBtn}
          </button>
        </div>
      </div>
    </div>
  );
};

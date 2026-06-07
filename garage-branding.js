// =================================================================
// FILE: garage-branding.js
// Description: Garage Branding Settings - Logo, Name, Contacts,
//              Color Scheme. Saves to Firestore & Firebase Storage.
//              Exports a helper used by all PDF generators.
// =================================================================

import { initializeApp, getApps } from "https://www.gstatic.com/firebasejs/12.6.0/firebase-app.js";
import {
    getFirestore,
    doc,
    getDoc,
    setDoc
} from "https://www.gstatic.com/firebasejs/12.6.0/firebase-firestore.js";

const firebaseConfig = {
    apiKey: "AIzaSyBCvFltNyGj3SYR-ADUocWD5EVjljoCEp8",
    authDomain: "garage-manager-1ac7c.firebaseapp.com",
    projectId: "garage-manager-1ac7c",
    storageBucket: "garage-manager-1ac7c.firebasestorage.app",
    messagingSenderId: "226684256206",
    appId: "1:226684256206:web:13d600d6db4c603506759f"
};

// Reuse existing app if already initialized
const app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);
const db  = getFirestore(app);

// The Firestore document path for branding settings
function getBrandingDoc() {
    const garageCode = sessionStorage.getItem('garageCode');
    if (garageCode) {
        return doc(db, 'garages', garageCode, 'settings', 'branding');
    }
    // Fallback for admin.html / unauthenticated preview
    return doc(db, 'settings', 'garageBranding');
}


// ─────────────────────────────────────────────
// In-memory cache so PDF builders can read it
// synchronously after the first load
// ─────────────────────────────────────────────
let _brandingCache = null;

/** Returns cached branding or fetches from Firestore */
export async function getBranding() {
    if (_brandingCache) return _brandingCache;
    try {
        const snap = await getDoc(getBrandingDoc());
        _brandingCache = snap.exists() ? snap.data() : getDefaultBranding();
    } catch {
        _brandingCache = getDefaultBranding();
    }
    return _brandingCache;
}

/** Invalidate cache (called after save) */
export function invalidateBrandingCache() {
    _brandingCache = null;
}

function getDefaultBranding() {
    return {
        garageName:  'Garage Manager PRO',
        tagline:     'The Ultimate Auto Service Tool',
        phone:       '',
        email:       '',
        address:     '',
        website:     '',
        primaryColor: '#1d4ed8',   // blue-700
        secondaryColor: '#1e3a5f', // dark navy
        accentColor:  '#f59e0b',   // amber
        logoUrl:     ''
    };
}

// ─────────────────────────────────────────────
// PDF Helper — call this at the top of any PDF
// function to draw a branded header + footer
// ─────────────────────────────────────────────

/**
 * Draws the garage branded header on a jsPDF document.
 * @param {jsPDF} pdfDoc
 * @param {object} branding  – result from getBranding()
 * @param {string} docTitle  – e.g. "INVOICE / RECEIPT"
 * @returns {number} y – the Y position after the header, ready for content
 */
export function drawPdfHeader(pdfDoc, branding, docTitle) {
    const pageW = pdfDoc.internal.pageSize.getWidth();

    // Parse hex color to RGB array
    const primary = hexToRgb(branding.primaryColor || '#1d4ed8');
    const accent  = hexToRgb(branding.accentColor  || '#f59e0b');

    // ── Top color bar ──
    pdfDoc.setFillColor(...primary);
    pdfDoc.rect(0, 0, pageW, 28, 'F');

    // ── Garage name & tagline ──
    pdfDoc.setTextColor(255, 255, 255);
    pdfDoc.setFontSize(16);
    pdfDoc.setFont('helvetica', 'bold');
    pdfDoc.text(branding.garageName || 'Garage Manager PRO', 14, 11);

    pdfDoc.setFontSize(8);
    pdfDoc.setFont('helvetica', 'normal');
    if (branding.tagline) {
        pdfDoc.text(branding.tagline, 14, 17);
    }

    // ── Contact info top-right ──
    pdfDoc.setFontSize(7.5);
    let contactLines = [];
    if (branding.phone)   contactLines.push(`Tel: ${branding.phone}`);
    if (branding.email)   contactLines.push(`Email: ${branding.email}`);
    if (branding.website) contactLines.push(branding.website);
    const contactX = pageW - 14;
    contactLines.forEach((line, i) => {
        pdfDoc.text(line, contactX, 9 + i * 5.5, { align: 'right' });
    });

    // ── Logo (if available) – drawn last so it overlays the bar ──
    if (branding.logoDataUrl) {
        try {
            // 22px tall, auto-width, anchored top-right of bar
            pdfDoc.addImage(branding.logoDataUrl, 'PNG', pageW - 44, 2, 30, 24, '', 'FAST');
        } catch (_) { /* logo rendering failed silently */ }
    }

    // ── Thin accent stripe below header ──
    pdfDoc.setFillColor(...accent);
    pdfDoc.rect(0, 28, pageW, 2, 'F');

    // ── Document title ──
    let y = 36;
    pdfDoc.setTextColor(...hexToRgb(branding.secondaryColor || '#1e3a5f'));
    pdfDoc.setFontSize(15);
    pdfDoc.setFont('helvetica', 'bold');
    pdfDoc.text(docTitle, 14, y);

    pdfDoc.setTextColor(100, 100, 100);
    pdfDoc.setFont('helvetica', 'normal');
    pdfDoc.setFontSize(8);
    pdfDoc.text(`Generated: ${new Date().toLocaleDateString('en-KE', {
        day: '2-digit', month: 'long', year: 'numeric'
    })}`, 14, y + 6);

    return y + 14; // return y ready for content
}

/**
 * Draws the branded footer on every page of a jsPDF document.
 * Call AFTER all content is added.
 * @param {jsPDF} pdfDoc
 * @param {object} branding
 */
export function drawPdfFooter(pdfDoc, branding) {
    const pageCount = pdfDoc.internal.getNumberOfPages();
    const pageW     = pdfDoc.internal.pageSize.getWidth();
    const pageH     = pdfDoc.internal.pageSize.getHeight();
    const primary   = hexToRgb(branding.primaryColor || '#1d4ed8');
    const accent    = hexToRgb(branding.accentColor  || '#f59e0b');

    for (let i = 1; i <= pageCount; i++) {
        pdfDoc.setPage(i);

        // Accent line above footer
        pdfDoc.setFillColor(...accent);
        pdfDoc.rect(0, pageH - 14, pageW, 1.5, 'F');

        // Footer bar
        pdfDoc.setFillColor(...primary);
        pdfDoc.rect(0, pageH - 12.5, pageW, 12.5, 'F');

        pdfDoc.setTextColor(255, 255, 255);
        pdfDoc.setFontSize(7);
        pdfDoc.setFont('helvetica', 'normal');

        let footerLeft = branding.garageName || 'Garage Manager PRO';
        if (branding.address) footerLeft += `  |  ${branding.address}`;
        pdfDoc.text(footerLeft, 14, pageH - 4.5);

        pdfDoc.text(`Page ${i} of ${pageCount}`, pageW - 14, pageH - 4.5, { align: 'right' });
    }
}

// ─────────────────────────────────────────────
// UI: Save / Load branding settings form
// ─────────────────────────────────────────────

export async function loadBrandingForm() {
    const branding = await getBranding();
    const fields = ['garageName','tagline','phone','email','address','website','primaryColor','secondaryColor','accentColor'];
    fields.forEach(f => {
        const el = document.getElementById(`branding-${f}`);
        if (el) el.value = branding[f] || (f.includes('Color') ? '#1d4ed8' : '');
    });
    // Show current logo preview (stored as base64 data URL directly in Firestore)
    const logoDataUrl = branding.logoDataUrl || branding.logoUrl || '';
    if (logoDataUrl) {
        const prev = document.getElementById('branding-logo-preview');
        if (prev) {
            prev.src = logoDataUrl;
            prev.classList.remove('hidden');
        }
    }
    updateColorPreviews();
}

export async function saveBrandingSettings() {
    const btn = document.getElementById('branding-save-btn');
    const msg = document.getElementById('branding-save-msg');
    btn.disabled = true;
    btn.textContent = 'Saving…';
    msg.textContent = '';

    try {
        const branding = {
            garageName:    document.getElementById('branding-garageName').value.trim(),
            tagline:       document.getElementById('branding-tagline').value.trim(),
            phone:         document.getElementById('branding-phone').value.trim(),
            email:         document.getElementById('branding-email').value.trim(),
            address:       document.getElementById('branding-address').value.trim(),
            website:       document.getElementById('branding-website').value.trim(),
            primaryColor:  document.getElementById('branding-primaryColor').value,
            secondaryColor:document.getElementById('branding-secondaryColor').value,
            accentColor:   document.getElementById('branding-accentColor').value,
        };

        // Handle logo — compress & store as base64 directly in Firestore (no Storage needed)
        const logoFile = document.getElementById('branding-logo-input').files[0];
        if (logoFile) {
            if (!logoFile.type.startsWith('image/')) throw new Error('Logo must be an image file.');
            if (logoFile.size > 2 * 1024 * 1024) throw new Error('Logo must be under 2 MB.');

            // Compress to max 200px wide, JPEG quality 0.7 — keeps Firestore doc small
            branding.logoDataUrl = await compressImageToDataUrl(logoFile, 200, 0.7);
        } else {
            // Preserve existing logo
            const existing = await getBranding();
            branding.logoDataUrl = existing.logoDataUrl || '';
        }

        await setDoc(getBrandingDoc(), branding);
        invalidateBrandingCache();

        msg.textContent = '✅ Branding saved successfully!';
        msg.className = 'text-green-600 text-sm mt-2 font-semibold';

        // Update logo preview
        if (branding.logoDataUrl) {
            const prev = document.getElementById('branding-logo-preview');
            if (prev) { prev.src = branding.logoDataUrl; prev.classList.remove('hidden'); }
        }

    } catch (err) {
        console.error('Branding save error:', err);
        msg.textContent = `❌ Error: ${err.message}`;
        msg.className = 'text-red-600 text-sm mt-2 font-semibold';
    } finally {
        btn.disabled = false;
        btn.textContent = 'Save Branding Settings';
    }
}

export function updateColorPreviews() {
    const primary   = document.getElementById('branding-primaryColor')?.value   || '#1d4ed8';
    const secondary = document.getElementById('branding-secondaryColor')?.value || '#1e3a5f';
    const accent    = document.getElementById('branding-accentColor')?.value    || '#f59e0b';

    const bar = document.getElementById('branding-color-preview');
    if (!bar) return;

    bar.style.background = `linear-gradient(to right, ${primary} 60%, ${accent} 100%)`;
    bar.style.borderLeft  = `6px solid ${secondary}`;

    const nameEl = document.getElementById('branding-preview-name');
    const tagEl  = document.getElementById('branding-preview-tagline');
    if (nameEl) nameEl.style.color = '#ffffff';
    if (tagEl)  tagEl.style.color  = '#ffffff';
}

// ─── Utility ──────────────────────────────────

function hexToRgb(hex) {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result
        ? [parseInt(result[1], 16), parseInt(result[2], 16), parseInt(result[3], 16)]
        : [29, 78, 216];
}

/**
 * Compresses an image File to a base64 data URL at a max width,
 * keeping aspect ratio, at the given JPEG quality (0–1).
 * Keeps PNG transparency if the file is a PNG.
 */
function compressImageToDataUrl(file, maxWidth = 200, quality = 0.7) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onerror = reject;
        reader.onload = (e) => {
            const img = new Image();
            img.onerror = reject;
            img.onload = () => {
                const scale  = Math.min(1, maxWidth / img.width);
                const canvas = document.createElement('canvas');
                canvas.width  = Math.round(img.width  * scale);
                canvas.height = Math.round(img.height * scale);
                canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
                const mime = file.type === 'image/png' ? 'image/png' : 'image/jpeg';
                resolve(canvas.toDataURL(mime, quality));
            };
            img.src = e.target.result;
        };
        reader.readAsDataURL(file);
    });
}

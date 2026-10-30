// iPhone Live : l'écran de l'iPhone 13 mini en direct, dans un iPhone à taille réelle posé
// sur le bureau Windows 10/11.
//
// Chaîne complète, sans Wi-Fi de box :
//   iPhone (appli gratuite PRISM, diffusion de l'écran en RTMP)
//     → partage de connexion de l'iPhone (Wi-Fi direct ou câble USB)
//     → ffmpeg sur le PC, en écoute sur le port 1935, qui décode en images brutes
//     → ce programme, qui les dessine dans l'écran du téléphone, sous le verre et l'encoche.
//
// Une seule fenêtre à transparence par pixel : le contour est dessiné une fois (en double
// résolution pour des bords nets), puis chaque image vidéo est posée dans l'écran.
//
// C# 5, .NET Framework 4.5+, aucune dépendance en dehors de ffmpeg.exe.

using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.Drawing;
using System.Drawing.Drawing2D;
using System.Drawing.Imaging;
using System.Drawing.Text;
using System.Globalization;
using System.IO;
using System.IO.Compression;
using System.Net;
using System.Net.NetworkInformation;
using System.Net.Sockets;
using System.Runtime.InteropServices;
using System.Text;
using System.Text.RegularExpressions;
using System.Threading;
using System.Windows.Forms;
using Microsoft.Win32;

namespace IPhoneLive
{
    // ------------------------------------------------------------------ Win32
    static class N
    {
        [StructLayout(LayoutKind.Sequential)]
        public struct POINT { public int X, Y; public POINT(int x, int y) { X = x; Y = y; } }
        [StructLayout(LayoutKind.Sequential)]
        public struct SIZE { public int W, H; public SIZE(int w, int h) { W = w; H = h; } }
        [StructLayout(LayoutKind.Sequential, Pack = 1)]
        public struct BLENDFUNCTION { public byte BlendOp, BlendFlags, SourceConstantAlpha, AlphaFormat; }
        [StructLayout(LayoutKind.Sequential)]
        public struct BITMAPINFOHEADER
        {
            public int biSize, biWidth, biHeight;
            public short biPlanes, biBitCount;
            public int biCompression, biSizeImage, biXPelsPerMeter, biYPelsPerMeter, biClrUsed, biClrImportant;
        }

        [DllImport("user32.dll")] public static extern bool UpdateLayeredWindow(IntPtr hwnd, IntPtr hdcDst, ref POINT pptDst, ref SIZE psize, IntPtr hdcSrc, ref POINT pptSrc, int crKey, ref BLENDFUNCTION pblend, int dwFlags);
        [DllImport("user32.dll")] public static extern IntPtr GetDC(IntPtr hwnd);
        [DllImport("user32.dll")] public static extern int ReleaseDC(IntPtr hwnd, IntPtr dc);
        [DllImport("gdi32.dll")] public static extern IntPtr CreateCompatibleDC(IntPtr dc);
        [DllImport("gdi32.dll")] public static extern bool DeleteDC(IntPtr dc);
        [DllImport("gdi32.dll")] public static extern IntPtr SelectObject(IntPtr dc, IntPtr obj);
        [DllImport("gdi32.dll")] public static extern bool DeleteObject(IntPtr obj);
        [DllImport("gdi32.dll")] public static extern IntPtr CreateDIBSection(IntPtr dc, ref BITMAPINFOHEADER bmi, uint usage, out IntPtr bits, IntPtr section, uint offset);
        [DllImport("user32.dll")] public static extern bool ReleaseCapture();
        [DllImport("user32.dll")] public static extern IntPtr SendMessage(IntPtr hwnd, int msg, IntPtr w, IntPtr l);
        [DllImport("user32.dll")] public static extern bool PostMessage(IntPtr hwnd, int msg, IntPtr w, IntPtr l);
        [DllImport("user32.dll", CharSet = CharSet.Unicode)] public static extern int RegisterWindowMessage(string name);
        [DllImport("user32.dll", CharSet = CharSet.Unicode)] public static extern IntPtr FindWindow(string cls, string title);
        [DllImport("user32.dll")] public static extern bool RegisterHotKey(IntPtr hwnd, int id, uint mods, uint vk);
        [DllImport("user32.dll")] public static extern bool UnregisterHotKey(IntPtr hwnd, int id);
        [DllImport("user32.dll")] public static extern bool SetWindowPos(IntPtr hwnd, IntPtr after, int x, int y, int w, int h, uint flags);
        [DllImport("user32.dll")] public static extern IntPtr MonitorFromPoint(POINT pt, uint flags);
        [DllImport("shcore.dll")] public static extern int GetDpiForMonitor(IntPtr monitor, int type, out uint x, out uint y);
        [DllImport("user32.dll")] public static extern bool SetProcessDpiAwarenessContext(IntPtr value);
        [DllImport("user32.dll")] public static extern bool SetProcessDPIAware();

        public static readonly IntPtr HWND_TOP = IntPtr.Zero, HWND_TOPMOST = new IntPtr(-1), HWND_BROADCAST = new IntPtr(0xffff);
        public const uint SWP_NOSIZE = 0x1, SWP_NOMOVE = 0x2, SWP_NOACTIVATE = 0x10;
    }

    // --------------------------------------------------------------- Réglages
    class Config
    {
        public string Color = "minuit";
        public int Scale = 100;
        public double PxPerMm;     // 0 = mesuré sur l'écran
        public bool TopMost;
        public int PosX = int.MinValue, PosY = int.MinValue;
        public bool Welcomed;

        public static string Folder
        {
            get { return Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "iPhoneLive"); }
        }
        static string FilePath { get { return Path.Combine(Folder, "reglages.ini"); } }

        public static Config Load()
        {
            Config c = new Config();
            try
            {
                if (!File.Exists(FilePath)) return c;
                foreach (string line in File.ReadAllLines(FilePath, Encoding.UTF8))
                {
                    int eq = line.IndexOf('=');
                    if (eq <= 0) continue;
                    string k = line.Substring(0, eq).Trim(), v = line.Substring(eq + 1).Trim();
                    int i;
                    double d;
                    switch (k)
                    {
                        case "Couleur": c.Color = v; break;
                        case "Echelle": if (int.TryParse(v, out i)) c.Scale = Math.Max(50, Math.Min(300, i)); break;
                        case "PixelsParMm": if (double.TryParse(v, NumberStyles.Float, CultureInfo.InvariantCulture, out d)) c.PxPerMm = d; break;
                        case "PremierPlan": c.TopMost = v == "1"; break;
                        case "X": if (int.TryParse(v, out i)) c.PosX = i; break;
                        case "Y": if (int.TryParse(v, out i)) c.PosY = i; break;
                        case "Bienvenue": c.Welcomed = v == "1"; break;
                    }
                }
            }
            catch { }
            return c;
        }

        public void Save()
        {
            try
            {
                Directory.CreateDirectory(Folder);
                StringBuilder sb = new StringBuilder();
                sb.AppendLine("; Réglages d'iPhone Live (modifiables par clic droit sur le téléphone)");
                sb.AppendLine("Couleur=" + Color);
                sb.AppendLine("Echelle=" + Scale);
                sb.AppendLine("PixelsParMm=" + PxPerMm.ToString("0.###", CultureInfo.InvariantCulture));
                sb.AppendLine("PremierPlan=" + (TopMost ? "1" : "0"));
                if (PosX != int.MinValue) sb.AppendLine("X=" + PosX);
                if (PosY != int.MinValue) sb.AppendLine("Y=" + PosY);
                sb.AppendLine("Bienvenue=" + (Welcomed ? "1" : "0"));
                File.WriteAllText(FilePath, sb.ToString(), Encoding.UTF8);
            }
            catch { }
        }
    }

    // ------------------------------------------------------------- Géométrie
    // Cotes Apple de l'iPhone 13 mini : 131,5 × 64,2 × 7,65 mm, écran 5,4" 2340 × 1080 à 476 ppp.
    class Layout
    {
        public const double BodyW = 64.2, BodyH = 131.5, ScreenW = 1080 / 476.0 * 25.4;
        public const double BodyR = 10.6, ScreenR = 7.0, Band = 0.95, NotchW = 26.0, NotchH = 5.1;

        public readonly double Ppm;
        public readonly Size Size;
        public readonly RectangleF Body;
        public readonly Rectangle Screen;

        public Layout(double ppm)
        {
            Ppm = ppm;
            int sw = (int)Math.Round(ScreenW * ppm);
            int sh = (int)Math.Round(sw * 2340.0 / 1080.0);
            float bw = (float)(BodyW * ppm), bh = (float)(BodyH * ppm);
            int margin = (int)Math.Ceiling(Math.Max(3.6 * ppm, 12));
            int shadow = (int)Math.Ceiling(2.6 * ppm);
            Size = new Size((int)Math.Ceiling(bw) + 2 * margin, (int)Math.Ceiling(bh) + 2 * margin + shadow);
            Body = new RectangleF(margin, margin, bw, bh);
            Screen = new Rectangle((int)Math.Round(margin + (bw - sw) / 2f), (int)Math.Round(margin + (bh - sh) / 2f), sw, sh);
        }

        public float Mm(double mm) { return (float)(mm * Ppm); }
        public Rectangle ScreenOuter { get { Rectangle r = Screen; r.Inflate(2, 2); return r; } }
    }

    class Scheme
    {
        public string Id, Label;
        public Color Mid, Light, Dark;
        Scheme(string id, string label, int mid, int light, int dark)
        {
            Id = id; Label = label;
            Mid = Color.FromArgb(mid | unchecked((int)0xFF000000));
            Light = Color.FromArgb(light | unchecked((int)0xFF000000));
            Dark = Color.FromArgb(dark | unchecked((int)0xFF000000));
        }

        // Les six finitions de l'iPhone 13 mini.
        public static readonly Scheme[] All = new Scheme[]
        {
            new Scheme("minuit", "Minuit", 0x2B3036, 0x5D6670, 0x111418),
            new Scheme("lumiere", "Lumière stellaire", 0xDCD5C9, 0xF8F4EC, 0xA59D8F),
            new Scheme("bleu", "Bleu", 0x2A4D6C, 0x6390B6, 0x132638),
            new Scheme("rose", "Rose", 0xECCBCB, 0xFDEBEA, 0xBD9898),
            new Scheme("vert", "Vert", 0x3C4D3A, 0x6F8669, 0x1C261C),
            new Scheme("rouge", "(PRODUCT)RED", 0xB2182B, 0xE5505D, 0x6B0D18),
        };

        public static Scheme Find(string id)
        {
            foreach (Scheme s in All) if (s.Id == id) return s;
            return All[0];
        }
    }

    // ------------------------------------------------------------------ Dessin
    static class Art
    {
        static readonly CultureInfo Fr = new CultureInfo("fr-FR");

        public static GraphicsPath RoundRect(RectangleF r, float rad)
        {
            GraphicsPath p = new GraphicsPath();
            float d = Math.Min(rad * 2, Math.Min(r.Width, r.Height));
            if (d <= 0.5f) { p.AddRectangle(r); return p; }
            p.AddArc(r.X, r.Y, d, d, 180, 90);
            p.AddArc(r.Right - d, r.Y, d, d, 270, 90);
            p.AddArc(r.Right - d, r.Bottom - d, d, d, 0, 90);
            p.AddArc(r.X, r.Bottom - d, d, d, 90, 90);
            p.CloseFigure();
            return p;
        }

        static RectangleF Inset(RectangleF r, float d) { return new RectangleF(r.X + d, r.Y + d, r.Width - 2 * d, r.Height - 2 * d); }
        static Color A(int a, Color c) { return Color.FromArgb(a, c); }

        // Corps du téléphone, écran transparent, encoche par-dessus. Dessiné en double
        // résolution puis réduit : les arrondis et les filets restent nets à toute taille.
        public static Bitmap Overlay(Layout L, Scheme s)
        {
            const int SS = 2;
            Layout big = new Layout(L.Ppm * SS);
            using (Bitmap hi = new Bitmap(big.Size.Width, big.Size.Height, PixelFormat.Format32bppPArgb))
            {
                using (Graphics g = Graphics.FromImage(hi))
                {
                    g.SmoothingMode = SmoothingMode.AntiAlias;
                    g.PixelOffsetMode = PixelOffsetMode.HighQuality;
                    DrawBody(g, big, s);
                    DrawNotch(g, big);
                }
                Bitmap lo = new Bitmap(L.Size.Width, L.Size.Height, PixelFormat.Format32bppPArgb);
                using (Graphics g = Graphics.FromImage(lo))
                {
                    g.CompositingMode = CompositingMode.SourceCopy;
                    g.InterpolationMode = InterpolationMode.HighQualityBicubic;
                    g.PixelOffsetMode = PixelOffsetMode.HighQuality;
                    using (ImageAttributes ia = new ImageAttributes())
                    {
                        ia.SetWrapMode(WrapMode.TileFlipXY); // pas de liseré sombre sur les bords
                        g.DrawImage(hi, new Rectangle(0, 0, lo.Width, lo.Height), 0, 0, hi.Width, hi.Height, GraphicsUnit.Pixel, ia);
                    }
                }
                return lo;
            }
        }

        static void DrawBody(Graphics g, Layout L, Scheme s)
        {
            RectangleF body = L.Body;
            float R = L.Mm(Layout.BodyR);
            using (GraphicsPath screen = RoundRect(L.Screen, L.Mm(Layout.ScreenR)))
            {
                // Ombre douce, jamais sous l'écran (qui doit rester vraiment transparent).
                for (int i = 16; i >= 1; i--)
                {
                    float grow = L.Mm(0.2 * i);
                    RectangleF r = new RectangleF(body.X - grow, body.Y - grow + L.Mm(1.2), body.Width + 2 * grow, body.Height + 2 * grow);
                    using (GraphicsPath p = RoundRect(r, R + grow))
                    using (SolidBrush b = new SolidBrush(Color.FromArgb(8, 0, 0, 0)))
                    {
                        p.AddPath(screen, false);
                        p.FillMode = FillMode.Alternate;
                        g.FillPath(b, p);
                    }
                }

                // Boutons : vibreur et volume à gauche, bouton latéral à droite.
                float bt = L.Mm(1.0), proud = L.Mm(0.6);
                Button(g, s, new RectangleF(body.X - proud, body.Y + L.Mm(19.5), bt, L.Mm(5.2)));
                Button(g, s, new RectangleF(body.X - proud, body.Y + L.Mm(30.5), bt, L.Mm(9.4)));
                Button(g, s, new RectangleF(body.X - proud, body.Y + L.Mm(43.0), bt, L.Mm(9.4)));
                Button(g, s, new RectangleF(body.Right + proud - bt, body.Y + L.Mm(33.5), bt, L.Mm(15.0)));

                // Tranche plate en aluminium : reflets verticaux comme sur les bords droits du 13 mini.
                using (GraphicsPath band = RoundRect(body, R))
                {
                    using (GraphicsPath inner = RoundRect(Inset(body, L.Mm(Layout.Band + 0.3)), R - L.Mm(Layout.Band + 0.3)))
                        band.AddPath(inner, false);
                    band.FillMode = FillMode.Alternate;
                    using (LinearGradientBrush b = new LinearGradientBrush(body, s.Mid, s.Mid, LinearGradientMode.Horizontal))
                    {
                        ColorBlend cb = new ColorBlend();
                        cb.Colors = new Color[] { s.Dark, s.Light, s.Mid, s.Dark, s.Mid, s.Light, s.Dark };
                        cb.Positions = new float[] { 0f, 0.025f, 0.08f, 0.5f, 0.92f, 0.975f, 1f };
                        b.InterpolationColors = cb;
                        g.FillPath(b, band);
                    }
                    // Lumière venue du haut sur la tranche.
                    using (LinearGradientBrush b = new LinearGradientBrush(body, Color.FromArgb(70, 255, 255, 255), Color.FromArgb(0, 255, 255, 255), LinearGradientMode.Vertical))
                        g.FillPath(b, band);
                }
                using (GraphicsPath rim = RoundRect(Inset(body, L.Mm(0.12)), R - L.Mm(0.12)))
                using (Pen p = new Pen(A(110, s.Light), Math.Max(1f, L.Mm(0.12))))
                    g.DrawPath(p, rim);

                // Bandes d'antenne : petits traits sur la tranche, en haut et en bas.
                using (SolidBrush ant = new SolidBrush(A(150, s.Dark)))
                {
                    float aw = L.Mm(Layout.Band + 0.2), ah = L.Mm(0.5);
                    foreach (float yy in new float[] { body.Y + L.Mm(11.5), body.Bottom - L.Mm(12.0) })
                    {
                        g.FillRectangle(ant, body.X - 1, yy, aw, ah);
                        g.FillRectangle(ant, body.Right - aw + 1, yy, aw, ah);
                    }
                    float ax = L.Mm(13.0);
                    g.FillRectangle(ant, body.Right - ax, body.Y - 1, ah, aw);
                    g.FillRectangle(ant, body.X + ax, body.Bottom - aw + 1, ah, aw);
                }

                // Verre avant noir, percé de l'écran.
                RectangleF glassR = Inset(body, L.Mm(Layout.Band));
                float gr = R - L.Mm(Layout.Band);
                using (GraphicsPath glass = RoundRect(glassR, gr))
                {
                    glass.AddPath(screen, false);
                    glass.FillMode = FillMode.Alternate;
                    using (SolidBrush b = new SolidBrush(Color.FromArgb(255, 4, 4, 6)))
                        g.FillPath(b, glass);
                }
                // Biseau du verre : un filet clair puis un filet sombre.
                using (GraphicsPath edge = RoundRect(Inset(glassR, L.Mm(0.08)), gr - L.Mm(0.08)))
                using (Pen p = new Pen(Color.FromArgb(60, 255, 255, 255), Math.Max(1f, L.Mm(0.09))))
                    g.DrawPath(p, edge);
                using (GraphicsPath edge = RoundRect(Inset(glassR, L.Mm(0.3)), gr - L.Mm(0.3)))
                using (Pen p = new Pen(Color.FromArgb(120, 0, 0, 0), Math.Max(1f, L.Mm(0.15))))
                    g.DrawPath(p, edge);
                // Reflet diagonal discret, seulement sur la bordure noire.
                using (GraphicsPath glass = RoundRect(glassR, gr))
                {
                    glass.AddPath(screen, false);
                    glass.FillMode = FillMode.Alternate;
                    using (LinearGradientBrush b = new LinearGradientBrush(glassR, Color.FromArgb(26, 255, 255, 255), Color.FromArgb(0, 255, 255, 255), LinearGradientMode.ForwardDiagonal))
                        g.FillPath(b, glass);
                }
            }
        }

        static void Button(Graphics g, Scheme s, RectangleF r)
        {
            using (GraphicsPath p = RoundRect(r, r.Width / 2))
            {
                using (LinearGradientBrush b = new LinearGradientBrush(r, s.Light, s.Dark, LinearGradientMode.Horizontal))
                    g.FillPath(b, p);
                using (Pen pen = new Pen(Color.FromArgb(90, 0, 0, 0), 1f))
                    g.DrawPath(pen, p);
            }
        }

        static void DrawNotch(Graphics g, Layout L)
        {
            RectangleF S = L.Screen;
            float w = L.Mm(Layout.NotchW), h = L.Mm(Layout.NotchH), r = L.Mm(2.6), f = L.Mm(0.85);
            float x = S.X + (S.Width - w) / 2, top = S.Y - 2, bottom = S.Y + h;
            using (GraphicsPath p = new GraphicsPath())
            {
                p.AddArc(x - 2 * f, top, 2 * f, 2 * f, 270, 90);
                p.AddArc(x, bottom - 2 * r, 2 * r, 2 * r, 180, -90);
                p.AddArc(x + w - 2 * r, bottom - 2 * r, 2 * r, 2 * r, 90, -90);
                p.AddArc(x + w, top, 2 * f, 2 * f, 180, 90);
                p.CloseFigure();
                using (SolidBrush b = new SolidBrush(Color.FromArgb(255, 4, 4, 6)))
                    g.FillPath(b, p);
            }
            // Haut-parleur, capteurs et caméra frontale.
            float sw = L.Mm(7.2), sh = Math.Max(2f, L.Mm(0.7));
            RectangleF speaker = new RectangleF(S.X + (S.Width - sw) / 2, S.Y + L.Mm(1.0), sw, sh);
            using (GraphicsPath p = RoundRect(speaker, sh / 2))
            using (LinearGradientBrush b = new LinearGradientBrush(speaker, Color.FromArgb(255, 40, 41, 46), Color.FromArgb(255, 18, 18, 22), LinearGradientMode.Vertical))
                g.FillPath(b, p);
            float cd = Math.Max(3f, L.Mm(1.8));
            RectangleF cam = new RectangleF(speaker.Right + L.Mm(3.3), S.Y + L.Mm(2.1) - cd / 2, cd, cd);
            using (SolidBrush b = new SolidBrush(Color.FromArgb(255, 12, 14, 24))) g.FillEllipse(b, cam);
            using (Pen p = new Pen(Color.FromArgb(255, 32, 34, 44), Math.Max(1f, cd * 0.12f))) g.DrawEllipse(p, cam);
            using (SolidBrush b = new SolidBrush(Color.FromArgb(150, 80, 100, 190)))
                g.FillEllipse(b, cam.X + cd * 0.28f, cam.Y + cd * 0.22f, cd * 0.26f, cd * 0.26f);
            float dd = Math.Max(2f, L.Mm(0.9));
            using (SolidBrush b = new SolidBrush(Color.FromArgb(255, 16, 16, 20)))
                g.FillEllipse(b, speaker.X - L.Mm(4.4), S.Y + L.Mm(2.1) - dd / 2, dd, dd);
        }

        static Font Font(string face, float px) { return new Font(face, Math.Max(6f, px), FontStyle.Regular, GraphicsUnit.Pixel); }

        // Écran d'attente façon écran verrouillé, avec l'adresse à taper dans PRISM.
        public static Bitmap Waiting(Size size, DateTime now, string ip, string status, bool lost, List<KeyValuePair<RectangleF, string>> spots)
        {
            int W = size.Width, H = size.Height;
            Bitmap bmp = new Bitmap(W, H, PixelFormat.Format32bppPArgb);
            using (Graphics g = Graphics.FromImage(bmp))
            {
                g.SmoothingMode = SmoothingMode.AntiAlias;
                g.TextRenderingHint = TextRenderingHint.AntiAliasGridFit;
                RectangleF S = new RectangleF(0, 0, W, H);

                using (LinearGradientBrush b = new LinearGradientBrush(S, Color.Black, Color.Black, LinearGradientMode.Vertical))
                {
                    ColorBlend cb = new ColorBlend();
                    cb.Colors = new Color[] { Color.FromArgb(10, 16, 40), Color.FromArgb(28, 34, 92), Color.FromArgb(92, 48, 120), Color.FromArgb(210, 110, 110) };
                    cb.Positions = new float[] { 0f, 0.4f, 0.75f, 1f };
                    b.InterpolationColors = cb;
                    g.FillRectangle(b, S);
                }
                Blob(g, -W * 0.3f, H * 0.04f, W * 0.95f, Color.FromArgb(150, 70, 120, 255));
                Blob(g, W * 0.4f, H * 0.5f, W * 1.0f, Color.FromArgb(120, 255, 110, 170));
                Blob(g, -W * 0.15f, H * 0.66f, W * 0.7f, Color.FromArgb(100, 80, 220, 255));

                StringFormat center = new StringFormat();
                center.Alignment = StringAlignment.Center;
                center.LineAlignment = StringAlignment.Center;

                // Barre d'état de part et d'autre de l'encoche.
                float side = W * 0.27f, barH = H * 0.045f;
                using (Font f = Font("Segoe UI Semibold", W * 0.043f))
                    g.DrawString(now.ToString("HH:mm"), f, Brushes.White, new RectangleF(W * 0.03f, 0, side, barH * 1.15f), center);
                float u = W * 0.011f, rx = W - side + W * 0.02f, cy = barH * 0.6f;
                for (int i = 0; i < 4; i++)
                {
                    float bh = u * (1.1f + i * 0.55f);
                    g.FillRectangle(Brushes.White, rx + i * u * 1.45f, cy + u * 1.6f - bh, u, bh);
                }
                RectangleF bat = new RectangleF(rx + u * 7.4f, cy - u * 1.3f, u * 5.6f, u * 2.9f);
                using (GraphicsPath bp = RoundRect(bat, u * 0.8f))
                using (Pen p = new Pen(Color.FromArgb(150, 255, 255, 255), Math.Max(1f, u * 0.28f)))
                    g.DrawPath(p, bp);
                using (GraphicsPath bp = RoundRect(Inset(bat, u * 0.5f), u * 0.4f)) g.FillPath(Brushes.White, bp);

                string date = now.ToString("dddd d MMMM", Fr);
                date = char.ToUpper(date[0], Fr) + date.Substring(1);
                using (Font f = Font("Segoe UI Semibold", W * 0.052f))
                    g.DrawString(date, f, Brushes.White, new RectangleF(0, H * 0.08f, W, H * 0.05f), center);
                using (Font f = Font("Segoe UI Light", W * 0.225f))
                    g.DrawString(now.ToString("HH:mm"), f, Brushes.White, new RectangleF(0, H * 0.12f, W, H * 0.15f), center);

                // Carte de connexion, verre dépoli.
                RectangleF card = new RectangleF(W * 0.06f, H * 0.34f, W * 0.88f, H * 0.56f);
                using (GraphicsPath p = RoundRect(card, W * 0.07f))
                {
                    using (SolidBrush b = new SolidBrush(Color.FromArgb(50, 255, 255, 255))) g.FillPath(b, p);
                    using (Pen pen = new Pen(Color.FromArgb(75, 255, 255, 255), Math.Max(1f, W * 0.004f))) g.DrawPath(pen, p);
                }
                float pad = W * 0.06f, y = card.Y + pad * 0.8f, cw = card.Width - 2 * pad;

                // Pastille d'état : verte quand le récepteur attend, orange sinon.
                bool ready = status.StartsWith("Prêt");
                float dot = W * 0.03f;
                using (SolidBrush b = new SolidBrush(ready ? Color.FromArgb(255, 52, 199, 89) : Color.FromArgb(255, 255, 159, 10)))
                    g.FillEllipse(b, card.X + pad, y + W * 0.022f, dot, dot);
                using (Font f = Font("Segoe UI Semibold", W * 0.05f))
                    g.DrawString(lost ? "Connexion perdue" : "iPhone Live", f, Brushes.White, card.X + pad + dot * 1.6f, y);
                y += W * 0.09f;
                using (Font f = Font("Segoe UI", W * 0.038f))
                using (SolidBrush b = new SolidBrush(Color.FromArgb(225, 255, 255, 255)))
                {
                    SizeF sz = g.MeasureString(status, f, (int)cw);
                    g.DrawString(status, f, b, new RectangleF(card.X + pad, y, cw, sz.Height + 2));
                    y += sz.Height + W * 0.03f;
                }

                // L'adresse à taper dans PRISM, en gros.
                using (Font f = Font("Segoe UI", W * 0.034f))
                using (SolidBrush b = new SolidBrush(Color.FromArgb(190, 255, 255, 255)))
                    g.DrawString("ADRESSE À TAPER DANS PRISM", f, b, card.X + pad, y);
                y += W * 0.055f;
                RectangleF addr = new RectangleF(card.X + pad, y, cw, W * 0.2f);
                using (GraphicsPath p = RoundRect(addr, W * 0.035f))
                using (SolidBrush b = new SolidBrush(Color.FromArgb(110, 0, 0, 0))) g.FillPath(b, p);
                string url = ip != null ? "rtmp://" + ip + "/live" : "Connectez le PC au partage de connexion";
                using (Font f = Font("Consolas", W * (ip != null ? 0.05f : 0.036f)))
                    g.DrawString(url, f, Brushes.White, new RectangleF(addr.X, addr.Y, addr.Width, addr.Height * 0.6f), center);
                using (Font f = Font("Segoe UI", W * 0.036f))
                using (SolidBrush b = new SolidBrush(Color.FromArgb(200, 255, 255, 255)))
                    g.DrawString("clé de stream : iphone", f, b, new RectangleF(addr.X, addr.Y + addr.Height * 0.52f, addr.Width, addr.Height * 0.42f), center);
                y = addr.Bottom + W * 0.04f;

                // Boutons.
                string[][] buttons = new string[][]
                {
                    new string[] { "Autoriser dans le pare-feu", "parefeu" },
                    new string[] { "Messages (Lien mobile)", "liens" },
                };
                float bh2 = W * 0.105f, gap = W * 0.028f;
                float room = card.Bottom - pad * 0.7f - y, needed = buttons.Length * bh2 + gap;
                if (room > needed) y += room - needed;
                for (int i = 0; i < buttons.Length; i++)
                {
                    RectangleF br = new RectangleF(card.X + pad, y, cw, bh2);
                    using (GraphicsPath p = RoundRect(br, bh2 / 2))
                    using (SolidBrush b = new SolidBrush(i == 0 ? Color.FromArgb(240, 255, 255, 255) : Color.FromArgb(55, 255, 255, 255)))
                        g.FillPath(b, p);
                    using (Font f = Font("Segoe UI Semibold", W * 0.04f))
                    using (SolidBrush b = new SolidBrush(i == 0 ? Color.FromArgb(255, 30, 30, 70) : Color.White))
                        g.DrawString(buttons[i][0], f, b, br, center);
                    spots.Add(new KeyValuePair<RectangleF, string>(br, buttons[i][1]));
                    y += bh2 + gap;
                }

                float hw = W * 0.36f, hh = Math.Max(3f, W * 0.013f);
                RectangleF home = new RectangleF((W - hw) / 2, H - H * 0.012f - hh, hw, hh);
                using (GraphicsPath p = RoundRect(home, hh / 2))
                using (SolidBrush b = new SolidBrush(Color.FromArgb(220, 255, 255, 255))) g.FillPath(b, p);
            }
            return bmp;
        }

        static void Blob(Graphics g, float x, float y, float d, Color c)
        {
            using (GraphicsPath p = new GraphicsPath())
            {
                p.AddEllipse(x, y, d, d);
                using (PathGradientBrush b = new PathGradientBrush(p))
                {
                    b.CenterColor = c;
                    b.SurroundColors = new Color[] { Color.FromArgb(0, c) };
                    g.FillPath(b, p);
                }
            }
        }

        public static Bitmap Icon(int size)
        {
            Bitmap bmp = new Bitmap(size, size, PixelFormat.Format32bppArgb);
            using (Graphics g = Graphics.FromImage(bmp))
            {
                g.SmoothingMode = SmoothingMode.AntiAlias;
                float h = size * 0.94f, w = h * 0.5f;
                RectangleF body = new RectangleF((size - w) / 2, (size - h) / 2, w, h);
                using (GraphicsPath p = RoundRect(body, w * 0.22f))
                using (SolidBrush b = new SolidBrush(Color.FromArgb(255, 30, 32, 38))) g.FillPath(b, p);
                float e = Math.Max(1f, w * 0.08f);
                RectangleF scr = new RectangleF(body.X + e, body.Y + e, body.Width - 2 * e, body.Height - 2 * e);
                using (GraphicsPath p = RoundRect(scr, w * 0.15f))
                using (LinearGradientBrush b = new LinearGradientBrush(scr, Color.FromArgb(70, 110, 255), Color.FromArgb(240, 110, 150), LinearGradientMode.ForwardDiagonal))
                    g.FillPath(b, p);
                // Point rouge « en direct ».
                float d = size * 0.3f;
                using (SolidBrush b = new SolidBrush(Color.FromArgb(255, 255, 59, 48)))
                    g.FillEllipse(b, size - d - size * 0.04f, size - d - size * 0.04f, d, d);
            }
            return bmp;
        }

        public static void WriteIco(string path)
        {
            int[] sizes = new int[] { 16, 24, 32, 48, 64, 256 };
            List<byte[]> pngs = new List<byte[]>();
            foreach (int s in sizes)
                using (Bitmap b = Icon(s))
                using (MemoryStream ms = new MemoryStream())
                {
                    b.Save(ms, ImageFormat.Png);
                    pngs.Add(ms.ToArray());
                }
            using (FileStream fs = File.Create(path))
            using (BinaryWriter w = new BinaryWriter(fs))
            {
                w.Write((short)0); w.Write((short)1); w.Write((short)sizes.Length);
                int offset = 6 + 16 * sizes.Length;
                for (int i = 0; i < sizes.Length; i++)
                {
                    w.Write((byte)(sizes[i] >= 256 ? 0 : sizes[i]));
                    w.Write((byte)(sizes[i] >= 256 ? 0 : sizes[i]));
                    w.Write((byte)0); w.Write((byte)0);
                    w.Write((short)1); w.Write((short)32);
                    w.Write(pngs[i].Length); w.Write(offset);
                    offset += pngs[i].Length;
                }
                foreach (byte[] png in pngs) w.Write(png);
            }
        }
    }

    // --------------------------------------------------------------- Récepteur
    // ffmpeg écoute le port 1935 (RTMP), décode la diffusion de PRISM et sort des images
    // brutes BGRA de taille fixe (carré C × C, image centrée sur fond noir) sur sa sortie
    // standard. Un fil lit ces images dans deux tampons épinglés qui alternent.
    class Receiver
    {
        public const int Port = 1935;
        const string ZipUrl = "https://github.com/BtbN/FFmpeg-Builds/releases/download/latest/ffmpeg-master-latest-win64-gpl.zip";

        public static string Folder { get { return Config.Folder; } }
        public static string Ffmpeg { get { return Path.Combine(Folder, "ffmpeg.exe"); } }
        public static bool Installed { get { return File.Exists(Ffmpeg); } }

        public volatile string Status = "";
        public volatile int SrcW, SrcH;
        public int Canvas { get; private set; }
        public long Frames;                 // images reçues depuis le lancement de l'appli
        public DateTime LastFrame = DateTime.MinValue;
        public event MethodInvoker FrameReady;

        Process proc;
        Thread reader, errReader, installer;
        byte[] front, back;
        GCHandle frontPin, backPin;
        readonly object swap = new object();
        DateTime lastStart = DateTime.MinValue;
        int quickFails;
        bool firstStart = true;

        public bool Running { get { try { return proc != null && !proc.HasExited; } catch { return false; } } }

        public void Start(int canvas)
        {
            if (!Installed || Running) return;
            // Évite de relancer en boucle si ffmpeg échoue tout de suite.
            if ((DateTime.Now - lastStart).TotalSeconds < Math.Min(30, 2 << Math.Min(quickFails, 4))) return;
            lastStart = DateTime.Now;
            // L'ancien fil de lecture doit avoir fini avant de remplacer les tampons.
            try { if (reader != null) reader.Join(1500); } catch { }
            if (firstStart) { KillOrphans(); firstStart = false; }
            lock (swap)
            {
                Free();
                Canvas = canvas;
                front = new byte[canvas * canvas * 4];
                back = new byte[canvas * canvas * 4];
                frontPin = GCHandle.Alloc(front, GCHandleType.Pinned);
                backPin = GCHandle.Alloc(back, GCHandleType.Pinned);
            }
            SrcW = SrcH = 0;

            string vf = "fps=30,scale=" + canvas + ":" + canvas + ":force_original_aspect_ratio=decrease:flags=bilinear," +
                        "pad=" + canvas + ":" + canvas + ":(ow-iw)/2:(oh-ih)/2:black,format=bgra";
            ProcessStartInfo psi = new ProcessStartInfo(Ffmpeg,
                "-hide_banner -loglevel info -nostats -fflags nobuffer -flags low_delay " +
                "-probesize 1000000 -analyzeduration 1000000 " +
                "-listen 1 -i rtmp://0.0.0.0:" + Port + "/live/iphone " +
                "-an -vf \"" + vf + "\" -f rawvideo -");
            psi.UseShellExecute = false;
            psi.CreateNoWindow = true;
            psi.RedirectStandardOutput = true;
            psi.RedirectStandardError = true;
            psi.WorkingDirectory = Folder;
            try { proc = Process.Start(psi); }
            catch (Exception ex) { Status = "Le récepteur n'a pas démarré : " + ex.Message; return; }
            Status = "Prêt : en attente de l'iPhone…";

            Process p = proc;
            long framesAtStart = Frames;
            reader = new Thread(delegate() { ReadFrames(p, framesAtStart); });
            reader.IsBackground = true;
            reader.Start();
            errReader = new Thread(delegate() { ReadErrors(p); });
            errReader.IsBackground = true;
            errReader.Start();
        }

        void ReadFrames(Process p, long framesAtStart)
        {
            try
            {
                Stream s = p.StandardOutput.BaseStream;
                int size;
                lock (swap) { if (back == null) return; size = back.Length; }
                while (true)
                {
                    int got = 0;
                    byte[] target;
                    lock (swap) { target = back; }
                    if (target == null || target.Length != size) return;
                    while (got < size)
                    {
                        int n = s.Read(target, got, size - got);
                        if (n <= 0) return;
                        got += n;
                    }
                    lock (swap)
                    {
                        if (back != target) return; // une nouvelle session a remplacé les tampons
                        byte[] t = front; front = back; back = t;
                        GCHandle h = frontPin; frontPin = backPin; backPin = h;
                        Frames++;
                        LastFrame = DateTime.Now;
                    }
                    MethodInvoker ev = FrameReady;
                    if (ev != null) ev();
                }
            }
            catch { }
            finally
            {
                if (Frames == framesAtStart) quickFails++; else quickFails = 0;
            }
        }

        static readonly Regex Dims = new Regex(@"Video:.*?(\d{2,5})x(\d{2,5})");

        void ReadErrors(Process p)
        {
            try
            {
                string line;
                bool input = true;
                while ((line = p.StandardError.ReadLine()) != null)
                {
                    if (line.StartsWith("Output #")) input = false;
                    Match m = Dims.Match(line);
                    if (m.Success && input)
                    {
                        SrcW = int.Parse(m.Groups[1].Value);
                        SrcH = int.Parse(m.Groups[2].Value);
                    }
                    string l = line.ToLowerInvariant();
                    if (l.Contains("address already in use") || l.Contains("bind"))
                        Status = "Le port " + Port + " est déjà pris : fermez l'autre récepteur (ancien widget, OBS…).";
                }
            }
            catch { }
        }

        // Donne l'image la plus récente au dessinateur, sans copie.
        public void WithFrame(Action<IntPtr, int> draw)
        {
            lock (swap)
            {
                if (front == null || !frontPin.IsAllocated) return;
                draw(frontPin.AddrOfPinnedObject(), Canvas);
            }
        }

        // Arrêt complet : le processus est vraiment terminé et le fil de lecture aussi, avant
        // que quiconque touche aux tampons ou au fichier ffmpeg.exe.
        public void Stop()
        {
            try { if (Running) { proc.Kill(); proc.WaitForExit(3000); } } catch { }
            proc = null;
            try { if (reader != null) reader.Join(1500); } catch { }
            try { if (errReader != null) errReader.Join(500); } catch { }
        }

        // Un ffmpeg resté orphelin (appli tuée, plantage) garderait le port 1935.
        static void KillOrphans()
        {
            foreach (Process p in Process.GetProcessesByName("ffmpeg"))
            {
                try
                {
                    if (string.Equals(p.MainModule.FileName, Ffmpeg, StringComparison.OrdinalIgnoreCase))
                    {
                        p.Kill();
                        p.WaitForExit(2000);
                    }
                }
                catch { }
            }
        }

        void Free()
        {
            if (frontPin.IsAllocated) frontPin.Free();
            if (backPin.IsAllocated) backPin.Free();
            front = back = null;
        }

        // Téléchargement unique de ffmpeg (FFmpeg-Builds sur GitHub, environ 200 Mo).
        public void Install(MethodInvoker done)
        {
            if (installer != null && installer.IsAlive) return;
            installer = new Thread(delegate()
            {
                string zip = Path.Combine(Folder, "ffmpeg.zip");
                try
                {
                    Directory.CreateDirectory(Folder);
                    ServicePointManager.SecurityProtocol = (SecurityProtocolType)3072; // TLS 1.2
                    Status = "Téléchargement du récepteur (une seule fois)…";
                    HttpWebRequest req = (HttpWebRequest)WebRequest.Create(ZipUrl);
                    req.UserAgent = "iPhoneLive";
                    using (WebResponse resp = req.GetResponse())
                    using (Stream input = resp.GetResponseStream())
                    using (FileStream output = File.Create(zip))
                    {
                        long total = resp.ContentLength, got = 0;
                        byte[] buf = new byte[1 << 16];
                        int n, last = -1;
                        while ((n = input.Read(buf, 0, buf.Length)) > 0)
                        {
                            output.Write(buf, 0, n);
                            got += n;
                            int pct = total > 0 ? (int)(got * 100 / total) : -1;
                            if (pct != last && pct >= 0) { last = pct; Status = "Téléchargement du récepteur : " + pct + " % (une seule fois)"; }
                        }
                    }
                    Status = "Installation du récepteur…";
                    // Extraction dans un fichier temporaire : ffmpeg.exe n'existe qu'une fois complet.
                    string tmp = Ffmpeg + ".tmp";
                    bool found = false;
                    using (ZipArchive za = ZipFile.OpenRead(zip))
                        foreach (ZipArchiveEntry e in za.Entries)
                            if (e.Name.Equals("ffmpeg.exe", StringComparison.OrdinalIgnoreCase))
                            {
                                e.ExtractToFile(tmp, true);
                                found = true;
                                break;
                            }
                    if (!found) throw new Exception("ffmpeg.exe introuvable dans le téléchargement.");
                    if (File.Exists(Ffmpeg)) File.Delete(Ffmpeg);
                    File.Move(tmp, Ffmpeg);
                    Status = "";
                }
                catch (Exception ex)
                {
                    InstallFailed = true;
                    Status = "Échec du téléchargement : " + ex.Message + " Clic droit → Réparer le récepteur pour réessayer.";
                }
                finally { try { File.Delete(zip); } catch { } }
                try { done(); } catch { }
            });
            installer.IsBackground = true;
            installer.Start();
        }

        public bool Installing { get { return installer != null && installer.IsAlive; } }
        public volatile bool InstallFailed;   // pas de nouvel essai automatique avant « Réparer »

        // Adresse du PC vue par l'iPhone : celle du partage de connexion (172.20.10.x),
        // que le lien passe par le Wi-Fi de l'iPhone ou par le câble USB.
        public static string LocalIp()
        {
            string fallback = null;
            try
            {
                foreach (NetworkInterface ni in NetworkInterface.GetAllNetworkInterfaces())
                {
                    if (ni.OperationalStatus != OperationalStatus.Up || ni.NetworkInterfaceType == NetworkInterfaceType.Loopback) continue;
                    foreach (UnicastIPAddressInformation a in ni.GetIPProperties().UnicastAddresses)
                    {
                        if (a.Address.AddressFamily != AddressFamily.InterNetwork) continue;
                        string ip = a.Address.ToString();
                        if (ip.StartsWith("172.20.10.")) return ip;
                        if (fallback == null && !ip.StartsWith("169.254.")) fallback = ip;
                    }
                }
            }
            catch { }
            return fallback;
        }

        public static bool OnHotspot()
        {
            string ip = LocalIp();
            return ip != null && ip.StartsWith("172.20.10.");
        }
    }

    // --------------------------------------------------- Où est l'écran dans l'image
    // Trouve le rectangle utile de l'image (sans les bandes noires que PRISM peut ajouter),
    // puis le cale exactement au format de l'iPhone pour que rien ne soit déformé.
    static class Framing
    {
        const double Phone = 2340.0 / 1080.0;

        public static RectangleF Find(IntPtr px, int c, out bool phoneShaped)
        {
            phoneShaped = false;
            RectangleF all = new RectangleF(0, 0, c, c);
            int step = Math.Max(2, c / 200), n = c / step;
            bool[] lit = new bool[n * n];
            int[] cols = new int[n];
            for (int j = 0; j < n; j++)
            {
                IntPtr row = new IntPtr(px.ToInt64() + (long)(j * step) * c * 4);
                for (int i = 0; i < n; i++)
                {
                    int v = Marshal.ReadInt32(row, i * step * 4);
                    if (((v >> 16) & 255) > 22 || ((v >> 8) & 255) > 22 || (v & 255) > 22)
                    {
                        lit[j * n + i] = true;
                        cols[i]++;
                    }
                }
            }
            // Colonnes « pleines » : l'écran de l'iPhone. Un logo ou un filigrane posé dans le
            // noir (« PRISM Live ») n'occupe que quelques lignes et ne compte pas.
            int c0, c1;
            if (!DenseRun(cols, out c0, out c1)) return all;
            int[] rows = new int[n];
            for (int j = 0; j < n; j++)
                for (int i = c0; i <= c1; i++)
                    if (lit[j * n + i]) rows[j]++;
            int r0, r1;
            if (!DenseRun(rows, out r0, out r1)) return all;
            RectangleF box = RectangleF.FromLTRB(c0 * step, r0 * step, (c1 + 1) * step, (r1 + 1) * step);

            double ratio = box.Height / Math.Max(1f, box.Width);
            bool portrait = Math.Abs(ratio - Phone) / Phone < 0.15, landscape = Math.Abs(ratio - 1 / Phone) / (1 / Phone) < 0.15;
            if (!portrait && !landscape) return box;
            phoneShaped = true;
            double target = portrait ? Phone : 1 / Phone;
            float cx = box.X + box.Width / 2, cy = box.Y + box.Height / 2;
            float bw = box.Width, bh = box.Height;
            if (bh / bw > target) bw = (float)(bh / target); else bh = (float)(bw * target);
            RectangleF snapped = new RectangleF(cx - bw / 2, cy - bh / 2, bw, bh);
            snapped.Intersect(all);
            return snapped;
        }

        // Plus longue suite de valeurs fortes (au moins 20 % du maximum), en tolérant de petits
        // trous : une bande sombre dans une appli ne coupe pas l'écran en deux.
        static bool DenseRun(int[] v, out int start, out int end)
        {
            start = end = -1;
            int max = 0;
            foreach (int x in v) if (x > max) max = x;
            if (max == 0) return false;
            int threshold = Math.Max(1, max / 5), gapMax = Math.Max(2, v.Length / 30);
            int bestLen = 0, s = -1, last = -1, gap = 0;
            for (int i = 0; i <= v.Length; i++)
            {
                bool dense = i < v.Length && v[i] >= threshold;
                if (dense)
                {
                    if (s < 0) s = i;
                    last = i;
                    gap = 0;
                }
                else if (s >= 0)
                {
                    gap++;
                    if (gap > gapMax || i == v.Length)
                    {
                        if (last - s + 1 > bestLen) { bestLen = last - s + 1; start = s; end = last; }
                        s = -1; gap = 0;
                    }
                }
            }
            return bestLen > 0;
        }
    }

    // ---------------------------------------------------------------- Le widget
    class PhoneForm : Form
    {
        public const string WindowTitle = "iPhone Live";
        const int HOTKEY_ID = 0x1313;
        readonly int WM_SHOW_ME = N.RegisterWindowMessage("iPhoneLive_Afficher");
        readonly int WM_QUIT_ME = N.RegisterWindowMessage("iPhoneLive_Quitter");

        Config cfg;
        Layout L;
        Bitmap overlay;
        Receiver rx = new Receiver();
        NotifyIcon tray;
        ContextMenuStrip menu;
        System.Windows.Forms.Timer timer;
        List<KeyValuePair<RectangleF, string>> spots = new List<KeyValuePair<RectangleF, string>>();

        // Surface de dessin : un DIB dont les octets servent directement à UpdateLayeredWindow.
        IntPtr dib, dibBits, memDc, oldObj;
        Bitmap surface;

        bool live, presentPending;
        RectangleF content = RectangleF.Empty;
        long framesAtCrop = -1000;
        string waitingKey = "";

        public PhoneForm()
        {
            cfg = Config.Load();
            FormBorderStyle = FormBorderStyle.None;
            ShowInTaskbar = false;
            StartPosition = FormStartPosition.Manual;
            Text = WindowTitle;
            TopMost = cfg.TopMost;

            BuildMenu();
            tray = new NotifyIcon();
            using (Bitmap b = Art.Icon(32)) tray.Icon = System.Drawing.Icon.FromHandle(b.GetHicon());
            tray.Text = "iPhone Live";
            tray.ContextMenuStrip = menu;
            tray.MouseClick += delegate(object s, MouseEventArgs e) { if (e.Button == MouseButtons.Left) ShowAll(); };
            tray.Visible = true;

            rx.FrameReady += delegate
            {
                // Une seule image en attente d'affichage à la fois : jamais de retard qui s'accumule.
                if (presentPending || !IsHandleCreated) return;
                presentPending = true;
                try { BeginInvoke((MethodInvoker)PresentLive); } catch { presentPending = false; }
            };

            timer = new System.Windows.Forms.Timer();
            timer.Interval = 500;
            timer.Tick += delegate { Tick(); };
        }

        protected override CreateParams CreateParams
        {
            get
            {
                CreateParams cp = base.CreateParams;
                cp.ExStyle |= 0x80000; // WS_EX_LAYERED
                return cp;
            }
        }

        protected override void OnLoad(EventArgs e)
        {
            base.OnLoad(e);
            Relayout();
            N.RegisterHotKey(Handle, HOTKEY_ID, 0x1 | 0x2 | 0x4000, (uint)Keys.I); // Ctrl+Alt+I
            SystemEvents.DisplaySettingsChanged += OnDisplayChanged;
            timer.Start();
            EnsureReceiver();
            if (!cfg.Welcomed)
            {
                cfg.Welcomed = true;
                cfg.Save();
                tray.ShowBalloonTip(10000, "iPhone Live est lancé",
                    "Glissez le contour pour déplacer le téléphone. Clic droit : réglages. Ctrl+Alt+I : afficher ou masquer.", ToolTipIcon.Info);
            }
        }

        void OnDisplayChanged(object sender, EventArgs e)
        {
            if (IsHandleCreated) BeginInvoke((MethodInvoker)delegate { Relayout(); });
        }

        // ---- Taille réelle

        static double DetectPpm(Point at)
        {
            try
            {
                IntPtr mon = N.MonitorFromPoint(new N.POINT(at.X, at.Y), 2);
                uint x, y;
                // DPI « brut » : la vraie densité de la dalle, lue dans l'EDID de l'écran.
                if (N.GetDpiForMonitor(mon, 2, out x, out y) == 0 && x >= 60 && x <= 700) return x / 25.4;
                if (N.GetDpiForMonitor(mon, 0, out x, out y) == 0 && x >= 60) return x / 25.4;
            }
            catch { }
            return 96 / 25.4;
        }

        Point Center { get { return new Point(Left + Width / 2, Top + Height / 2); } }
        double BasePpm { get { return cfg.PxPerMm > 0 ? cfg.PxPerMm : DetectPpm(Center); } }

        void Relayout()
        {
            Rectangle wa = Screen.PrimaryScreen.WorkingArea;
            bool placed = cfg.PosX != int.MinValue;
            Point probe = placed ? new Point(cfg.PosX + 60, cfg.PosY + 60) : new Point(wa.Right - 60, wa.Bottom - 60);
            double ppm = cfg.PxPerMm > 0 ? cfg.PxPerMm : DetectPpm(probe);
            L = new Layout(ppm * cfg.Scale / 100.0);
            Point pos = placed ? new Point(cfg.PosX, cfg.PosY) : new Point(wa.Right - L.Size.Width - 40, wa.Bottom - L.Size.Height);
            Rectangle vs = SystemInformation.VirtualScreen;
            pos.X = Math.Max(vs.Left - L.Size.Width / 2, Math.Min(pos.X, vs.Right - L.Size.Width / 2));
            pos.Y = Math.Max(vs.Top, Math.Min(pos.Y, vs.Bottom - L.Size.Height / 3));

            if (overlay != null) overlay.Dispose();
            overlay = Art.Overlay(L, Scheme.Find(cfg.Color));
            CreateSurface(L.Size);
            Bounds = new Rectangle(pos, L.Size);

            // La taille des images décodées suit celle de l'écran (un peu plus grande, pour la netteté).
            int canvas = Math.Max(640, Math.Min(1600, (int)(L.Screen.Height * 1.15) / 16 * 16));
            if (rx.Running && rx.Canvas != canvas) rx.Stop();
            waitingKey = "";
            Redraw();
        }

        void CreateSurface(Size size)
        {
            FreeSurface();
            N.BITMAPINFOHEADER bi = new N.BITMAPINFOHEADER();
            bi.biSize = Marshal.SizeOf(typeof(N.BITMAPINFOHEADER));
            bi.biWidth = size.Width;
            bi.biHeight = -size.Height; // de haut en bas
            bi.biPlanes = 1;
            bi.biBitCount = 32;
            IntPtr screenDc = N.GetDC(IntPtr.Zero);
            dib = N.CreateDIBSection(screenDc, ref bi, 0, out dibBits, IntPtr.Zero, 0);
            memDc = N.CreateCompatibleDC(screenDc);
            N.ReleaseDC(IntPtr.Zero, screenDc);
            oldObj = N.SelectObject(memDc, dib);
            surface = new Bitmap(size.Width, size.Height, size.Width * 4, PixelFormat.Format32bppPArgb, dibBits);
        }

        void FreeSurface()
        {
            if (surface != null) { surface.Dispose(); surface = null; }
            if (memDc != IntPtr.Zero) { N.SelectObject(memDc, oldObj); N.DeleteDC(memDc); memDc = IntPtr.Zero; }
            if (dib != IntPtr.Zero) { N.DeleteObject(dib); dib = IntPtr.Zero; }
        }

        void Push()
        {
            IntPtr screenDc = N.GetDC(IntPtr.Zero);
            N.SIZE size = new N.SIZE(L.Size.Width, L.Size.Height);
            N.POINT src = new N.POINT(0, 0), dst = new N.POINT(Left, Top);
            N.BLENDFUNCTION blend = new N.BLENDFUNCTION();
            blend.SourceConstantAlpha = 255;
            blend.AlphaFormat = 1; // AC_SRC_ALPHA
            N.UpdateLayeredWindow(Handle, screenDc, ref dst, ref size, memDc, ref src, 0, ref blend, 2);
            N.ReleaseDC(IntPtr.Zero, screenDc);
        }

        // Pose le contenu de l'écran, puis le contour et l'encoche par-dessus.
        void Compose(Action<Graphics, Rectangle> drawScreen)
        {
            using (Graphics g = Graphics.FromImage(surface))
            {
                Rectangle area = L.ScreenOuter;
                g.CompositingMode = CompositingMode.SourceCopy;
                g.DrawImage(overlay, new Rectangle(0, 0, overlay.Width, overlay.Height), 0, 0, overlay.Width, overlay.Height, GraphicsUnit.Pixel);
                using (SolidBrush black = new SolidBrush(Color.Black)) g.FillRectangle(black, area);
                drawScreen(g, L.Screen);
                g.CompositingMode = CompositingMode.SourceOver;
                g.DrawImage(overlay, area, area, GraphicsUnit.Pixel);
            }
            Push();
        }

        // ---- Affichage en direct

        void PresentLive()
        {
            presentPending = false;
            if (L == null || surface == null || !Visible) return;
            if (!live) { live = true; framesAtCrop = -1000; }
            Compose(delegate(Graphics g, Rectangle hole)
            {
                rx.WithFrame(delegate(IntPtr px, int c)
                {
                    // Le cadrage est recalculé toutes les 30 images (rotation, changement de taille).
                    if (rx.Frames - framesAtCrop >= 30 || content.IsEmpty)
                    {
                        bool phone;
                        RectangleF found = Framing.Find(px, c, out phone);
                        // Un écran d'iPhone reconnu remplace toujours l'ancien cadrage ; une image
                        // ambiguë (écran noir pendant un changement d'appli) ne le remplace pas.
                        if (content.IsEmpty || (phone && (Math.Abs(found.Width - content.Width) > 2 || Math.Abs(found.Height - content.Height) > 2
                            || Math.Abs(found.X - content.X) > 2 || Math.Abs(found.Y - content.Y) > 2)))
                            content = found;
                        framesAtCrop = rx.Frames;
                    }
                    using (Bitmap frame = new Bitmap(c, c, c * 4, PixelFormat.Format32bppRgb, px))
                    {
                        g.InterpolationMode = InterpolationMode.Bilinear;
                        g.PixelOffsetMode = PixelOffsetMode.Half;
                        g.CompositingMode = CompositingMode.SourceCopy;
                        // Format respecté : l'iPhone en portrait remplit l'écran, en paysage il est centré.
                        float s = Math.Min(hole.Width / content.Width, hole.Height / content.Height);
                        float w = content.Width * s, h = content.Height * s;
                        RectangleF dst = new RectangleF(hole.X + (hole.Width - w) / 2, hole.Y + (hole.Height - h) / 2, w, h);
                        if (Math.Abs(w - hole.Width) < 3 && Math.Abs(h - hole.Height) < 3) dst = hole; // plein écran exact
                        g.DrawImage(frame, dst, content, GraphicsUnit.Pixel);
                    }
                });
            });
        }

        // ---- Écran d'attente

        void Redraw()
        {
            if (L == null || surface == null) return;
            if (live) return;
            string ip = Receiver.LocalIp();
            string status = StatusText();
            DateTime now = DateTime.Now;
            bool lost = rx.LastFrame != DateTime.MinValue;
            string key = now.ToString("HH:mm") + ip + status + lost + L.Size;
            if (key == waitingKey) return;
            waitingKey = key;
            spots.Clear();
            List<KeyValuePair<RectangleF, string>> local = new List<KeyValuePair<RectangleF, string>>();
            using (Bitmap screen = Art.Waiting(L.Screen.Size, now, ip, status, lost, local))
            {
                foreach (KeyValuePair<RectangleF, string> kv in local)
                {
                    RectangleF r = kv.Key;
                    r.Offset(L.Screen.X, L.Screen.Y);
                    spots.Add(new KeyValuePair<RectangleF, string>(r, kv.Value));
                }
                Compose(delegate(Graphics g, Rectangle hole)
                {
                    g.CompositingMode = CompositingMode.SourceCopy;
                    g.DrawImage(screen, hole, new Rectangle(0, 0, screen.Width, screen.Height), GraphicsUnit.Pixel);
                });
            }
        }

        string StatusText()
        {
            if (rx.Status.Length > 0 && !rx.Status.StartsWith("Prêt")) return rx.Status;
            if (!Receiver.Installed) return "Le récepteur va se télécharger (une seule fois).";
            if (!Receiver.OnHotspot())
                return "Activez le partage de connexion de l'iPhone et connectez-y le PC (Wi-Fi ou câble USB).";
            return rx.Running ? "Prêt : lancez la diffusion de l'écran dans PRISM." : "Démarrage du récepteur…";
        }

        int CanvasFor() { return Math.Max(640, Math.Min(1600, (int)(L.Screen.Height * 1.15) / 16 * 16)); }

        void EnsureReceiver()
        {
            if (!Receiver.Installed)
            {
                if (!rx.Installing && !rx.InstallFailed)
                    rx.Install(delegate
                    {
                        try { if (IsHandleCreated && !IsDisposed) BeginInvoke((MethodInvoker)delegate { EnsureReceiver(); waitingKey = ""; Redraw(); }); }
                        catch { } // fenêtre fermée pendant le téléchargement
                    });
                return;
            }
            rx.Start(CanvasFor());
        }

        void Tick()
        {
            // Plus d'image depuis 3 s : la diffusion est coupée, on revient à l'écran d'attente.
            if (live && (DateTime.Now - rx.LastFrame).TotalSeconds > 3)
            {
                live = false;
                content = RectangleF.Empty;
                waitingKey = "";
            }
            if (!rx.Running) EnsureReceiver();
            Redraw();
        }

        // ---- Souris, raccourci, menu

        protected override void OnMouseDown(MouseEventArgs e)
        {
            base.OnMouseDown(e);
            if (e.Button == MouseButtons.Right) { menu.Show(Cursor.Position); return; }
            if (e.Button != MouseButtons.Left) return;
            if (!live)
                foreach (KeyValuePair<RectangleF, string> s in spots)
                    if (s.Key.Contains(e.Location)) { Do(s.Value); return; }
            N.ReleaseCapture();
            N.SendMessage(Handle, 0xA1, new IntPtr(2), IntPtr.Zero); // glisser comme une barre de titre
            cfg.PosX = Left; cfg.PosY = Top;
            cfg.Save();
            if (cfg.PxPerMm <= 0 && Math.Abs(DetectPpm(Center) * cfg.Scale / 100.0 - L.Ppm) > 0.01) Relayout();
        }

        protected override void WndProc(ref Message m)
        {
            if (m.Msg == 0x0312 && m.WParam.ToInt32() == HOTKEY_ID) { Toggle(false); return; }
            if (m.Msg == WM_SHOW_ME && WM_SHOW_ME != 0) { ShowAll(); return; }
            if (m.Msg == WM_QUIT_ME && WM_QUIT_ME != 0) { Close(); return; }
            if (m.Msg == 0x02E0) return; // WM_DPICHANGED : géré après le déplacement
            base.WndProc(ref m);
        }

        // Raccourci : masque seulement si le téléphone est déjà devant. Menu : bascule simple
        // (le menu prend le focus, le téléphone n'est donc jamais « actif » à ce moment-là).
        void Toggle(bool fromMenu)
        {
            bool hide = fromMenu ? Visible : Visible && Form.ActiveForm == this;
            if (hide) Hide(); else ShowAll();
        }

        void ShowAll()
        {
            if (!Visible) Show();
            waitingKey = "";
            Redraw();
            N.SetWindowPos(Handle, cfg.TopMost ? N.HWND_TOPMOST : N.HWND_TOP, 0, 0, 0, 0, N.SWP_NOMOVE | N.SWP_NOSIZE);
            Activate();
        }

        void Do(string action)
        {
            switch (action)
            {
                case "parefeu": AllowFirewall(); break;
                case "liens":
                    try { Process.Start("explorer.exe", "shell:AppsFolder\\Microsoft.YourPhone_8wekyb3d8bbwe!App"); } catch { }
                    break;
            }
        }

        // Autorise ffmpeg à recevoir la diffusion, sur tous les types de réseau (le partage de
        // connexion est vu comme « Public »). Passe par cmd et netsh, pas par PowerShell.
        void AllowFirewall()
        {
            string exe = Receiver.Ffmpeg;
            string args = "/c netsh advfirewall firewall delete rule name=all program=\"" + exe + "\" & " +
                          "netsh advfirewall firewall add rule name=\"iPhone Live\" dir=in action=allow program=\"" + exe + "\" enable=yes profile=any";
            try
            {
                ProcessStartInfo psi = new ProcessStartInfo("cmd.exe", args);
                psi.Verb = "runas";
                psi.UseShellExecute = true;
                psi.WindowStyle = ProcessWindowStyle.Hidden;
                Process.Start(psi);
                tray.ShowBalloonTip(6000, "Pare-feu", "Le récepteur est autorisé. Lancez la diffusion dans PRISM.", ToolTipIcon.Info);
            }
            catch
            {
                MessageBox.Show(this,
                    "Windows a refusé la demande. Autorisez le récepteur à la main :\n\n" +
                    "1. Windows + R, tapez :  control /name Microsoft.WindowsFirewall /page pageConfigureApps\n" +
                    "2. Modifier les paramètres, puis Autoriser une autre application…\n" +
                    "3. Parcourir : " + exe + "\n" +
                    "4. Cochez Privé et Public, puis OK.",
                    "iPhone Live", MessageBoxButtons.OK, MessageBoxIcon.Information);
            }
        }

        ToolStripMenuItem itemAddr, itemTop, itemStartup, itemSize, itemColor;

        void BuildMenu()
        {
            menu = new ContextMenuStrip();
            itemAddr = new ToolStripMenuItem("");
            itemAddr.Enabled = false;
            menu.Items.Add(itemAddr);
            menu.Items.Add("Copier l'adresse pour PRISM", null, delegate
            {
                string ip = Receiver.LocalIp();
                if (ip != null) try { Clipboard.SetText("rtmp://" + ip + "/live"); } catch { }
            });
            menu.Items.Add("Autoriser le récepteur dans le pare-feu", null, delegate { AllowFirewall(); });
            menu.Items.Add("Réparer le récepteur (re-télécharger)", null, delegate
            {
                rx.Stop();
                try { File.Delete(Receiver.Ffmpeg); } catch { }
                rx.InstallFailed = false;
                rx.Status = "";
                EnsureReceiver();
            });
            menu.Items.Add(new ToolStripSeparator());

            itemSize = new ToolStripMenuItem("Taille");
            foreach (int sc in new int[] { 100, 115, 130, 150, 175, 200 })
            {
                int v = sc;
                ToolStripMenuItem it = new ToolStripMenuItem(v == 100 ? "Taille réelle (100 %)" : v + " %", null, delegate { cfg.Scale = v; cfg.Save(); Relayout(); });
                it.Tag = v;
                itemSize.DropDownItems.Add(it);
            }
            itemSize.DropDownItems.Add(new ToolStripSeparator());
            itemSize.DropDownItems.Add("Calibrer la taille réelle…", null, delegate { Calibrate(); });
            menu.Items.Add(itemSize);

            itemColor = new ToolStripMenuItem("Couleur");
            foreach (Scheme s in Scheme.All)
            {
                Scheme sc = s;
                ToolStripMenuItem it = new ToolStripMenuItem(s.Label, null, delegate { cfg.Color = sc.Id; cfg.Save(); Relayout(); });
                it.Tag = s.Id;
                itemColor.DropDownItems.Add(it);
            }
            menu.Items.Add(itemColor);

            itemTop = new ToolStripMenuItem("Toujours au premier plan", null, delegate
            {
                cfg.TopMost = !cfg.TopMost; cfg.Save(); TopMost = cfg.TopMost;
            });
            menu.Items.Add(itemTop);
            itemStartup = new ToolStripMenuItem("Lancer au démarrage de Windows", null, delegate { SetStartup(!IsStartup()); });
            menu.Items.Add(itemStartup);
            menu.Items.Add(new ToolStripSeparator());
            menu.Items.Add("Ouvrir Lien mobile (messages, appels)", null, delegate { Do("liens"); });
            menu.Items.Add("Afficher / masquer (Ctrl+Alt+I)", null, delegate { Toggle(true); });
            menu.Items.Add("Quitter", null, delegate { Close(); });

            menu.Opening += delegate
            {
                string ip = Receiver.LocalIp();
                itemAddr.Text = ip != null ? "PRISM : rtmp://" + ip + "/live  ·  clé iphone" : "PC non connecté au partage de connexion";
                itemTop.Checked = cfg.TopMost;
                itemStartup.Checked = IsStartup();
                foreach (ToolStripItem it in itemSize.DropDownItems)
                {
                    ToolStripMenuItem mi = it as ToolStripMenuItem;
                    if (mi != null && mi.Tag is int) mi.Checked = (int)mi.Tag == cfg.Scale;
                }
                foreach (ToolStripItem it in itemColor.DropDownItems)
                {
                    ToolStripMenuItem mi = it as ToolStripMenuItem;
                    if (mi != null) mi.Checked = (string)mi.Tag == Scheme.Find(cfg.Color).Id;
                }
            };
        }

        const string RunKey = @"Software\Microsoft\Windows\CurrentVersion\Run";

        static bool IsStartup()
        {
            using (RegistryKey k = Registry.CurrentUser.OpenSubKey(RunKey))
                return k != null && k.GetValue("iPhoneLive") != null;
        }

        static void SetStartup(bool on)
        {
            using (RegistryKey k = Registry.CurrentUser.CreateSubKey(RunKey))
            {
                if (on) k.SetValue("iPhoneLive", "\"" + Application.ExecutablePath + "\"");
                else if (k.GetValue("iPhoneLive") != null) k.DeleteValue("iPhoneLive");
            }
        }

        void Calibrate()
        {
            double ppm = BasePpm;
            using (Form f = new Form())
            {
                f.Text = "Calibrer la taille réelle";
                f.FormBorderStyle = FormBorderStyle.FixedDialog;
                f.MaximizeBox = false; f.MinimizeBox = false;
                f.StartPosition = FormStartPosition.CenterScreen;
                f.TopMost = true;
                f.Font = new Font("Segoe UI", 13f, FontStyle.Regular, GraphicsUnit.Pixel);
                Label help = new Label();
                help.Text = "Posez une carte bancaire contre l'écran et réglez le curseur pour que le rectangle ait exactement sa largeur.";
                help.SetBounds(12, 10, 616, 40);
                Panel card = new Panel();
                card.SetBounds(12, 56, 616, 300);
                card.Paint += delegate(object s, PaintEventArgs e)
                {
                    e.Graphics.SmoothingMode = SmoothingMode.AntiAlias;
                    RectangleF r = new RectangleF(4, 4, (float)(85.6 * ppm), (float)(53.98 * ppm));
                    using (GraphicsPath p = Art.RoundRect(r, (float)(3.2 * ppm)))
                    using (LinearGradientBrush b = new LinearGradientBrush(r, Color.FromArgb(40, 70, 160), Color.FromArgb(120, 60, 170), LinearGradientMode.ForwardDiagonal))
                        e.Graphics.FillPath(b, p);
                    e.Graphics.DrawString("Carte bancaire · 85,6 mm", f.Font, Brushes.White, 14, 14);
                };
                TrackBar tb = new TrackBar();
                tb.Minimum = 150; tb.Maximum = 1600; tb.TickFrequency = 50;
                tb.Value = (int)Math.Max(150, Math.Min(1600, Math.Round(ppm * 100)));
                Button auto = new Button(); auto.Text = "Mesure automatique"; auto.Size = new Size(200, 36);
                Button ok = new Button(); ok.Text = "Enregistrer"; ok.Size = new Size(200, 36);
                ok.DialogResult = DialogResult.OK;
                Action fit = delegate
                {
                    card.Width = Math.Max(616, (int)(85.6 * ppm) + 40);
                    card.Height = Math.Max(300, (int)(53.98 * ppm) + 20);
                    tb.SetBounds(12, card.Bottom + 6, card.Width, 40);
                    auto.Location = new Point(12, tb.Bottom + 12);
                    ok.Location = new Point(card.Right - ok.Width, tb.Bottom + 12);
                    f.ClientSize = new Size(card.Right + 12, ok.Bottom + 12);
                    card.Invalidate();
                };
                tb.ValueChanged += delegate { ppm = tb.Value / 100.0; fit(); };
                auto.Click += delegate { cfg.PxPerMm = 0; cfg.Save(); Relayout(); f.Close(); };
                f.Controls.AddRange(new Control[] { help, card, tb, auto, ok });
                fit();
                if (f.ShowDialog() == DialogResult.OK) { cfg.PxPerMm = ppm; cfg.Save(); Relayout(); }
            }
        }

        protected override void OnFormClosing(FormClosingEventArgs e)
        {
            timer.Stop();
            rx.Stop();
            SystemEvents.DisplaySettingsChanged -= OnDisplayChanged;
            N.UnregisterHotKey(Handle, HOTKEY_ID);
            cfg.PosX = Left; cfg.PosY = Top;
            cfg.Save();
            tray.Visible = false;
            base.OnFormClosing(e);
        }
    }

    // ------------------------------------------------------------- Démarrage
    static class App
    {
        [STAThread]
        static void Main(string[] args)
        {
            if (args.Length == 2 && args[0] == "--icone") { Art.WriteIco(args[1]); return; }
            if (args.Length == 1 && args[0] == "--quitter")
            {
                // FindWindow trouve aussi la fenêtre quand elle est masquée (un broadcast, non).
                IntPtr w = N.FindWindow(null, PhoneForm.WindowTitle);
                if (w != IntPtr.Zero) N.PostMessage(w, N.RegisterWindowMessage("iPhoneLive_Quitter"), IntPtr.Zero, IntPtr.Zero);
                return;
            }
            // Pixels physiques : indispensable pour la taille réelle. Windows 10 1703+ puis repli.
            try { if (!N.SetProcessDpiAwarenessContext(new IntPtr(-4))) N.SetProcessDPIAware(); }
            catch { try { N.SetProcessDPIAware(); } catch { } }

            bool created;
            using (Mutex mutex = new Mutex(true, "Local\\iPhoneLive_Widget", out created))
            {
                if (!created)
                {
                    IntPtr w = N.FindWindow(null, PhoneForm.WindowTitle);
                    if (w != IntPtr.Zero) N.PostMessage(w, N.RegisterWindowMessage("iPhoneLive_Afficher"), IntPtr.Zero, IntPtr.Zero);
                    return;
                }
                Application.EnableVisualStyles();
                Application.SetCompatibleTextRenderingDefault(false);
                Application.ThreadException += delegate(object s, ThreadExceptionEventArgs e) { Log(e.Exception); };
                AppDomain.CurrentDomain.UnhandledException += delegate(object s, UnhandledExceptionEventArgs e) { Log(e.ExceptionObject as Exception); };
                Application.Run(new PhoneForm());
            }
        }

        static void Log(Exception ex)
        {
            try
            {
                Directory.CreateDirectory(Config.Folder);
                File.AppendAllText(Path.Combine(Config.Folder, "erreurs.txt"), DateTime.Now + "  " + ex + Environment.NewLine);
            }
            catch { }
        }
    }
}

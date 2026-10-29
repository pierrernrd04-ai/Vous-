// iPhone Bureau : l'écran de l'iPhone 13 mini, à taille réelle, posé sur le bureau Windows 11.
//
// Le widget dessine le corps du téléphone (contour, verre, encoche, boutons) dans une fenêtre
// à transparence par pixel. L'écran est un trou : la fenêtre de l'appli de recopie (MirrorTo,
// AirDroid Cast, LetsView, UxPlay…) est glissée juste dessous, débarrassée de sa barre de titre,
// découpée aux coins arrondis de l'écran et collée au widget. Les clics et le clavier vont donc
// directement à l'appli de recopie, qui les transmet à l'iPhone quand elle sait le faire.
//
// Compilé par Installer.ps1 (C# 5, .NET Framework 4, aucune dépendance).

using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.Drawing;
using System.Drawing.Drawing2D;
using System.Drawing.Imaging;
using System.Drawing.Text;
using System.Globalization;
using System.IO;
using System.Runtime.InteropServices;
using System.Text;
using System.Threading;
using System.Windows.Forms;
using Microsoft.Win32;

namespace IPhoneBureau
{
    // ------------------------------------------------------------------ Win32
    static class N
    {
        [StructLayout(LayoutKind.Sequential)]
        public struct POINT { public int X, Y; public POINT(int x, int y) { X = x; Y = y; } }
        [StructLayout(LayoutKind.Sequential)]
        public struct SIZE { public int W, H; public SIZE(int w, int h) { W = w; H = h; } }
        [StructLayout(LayoutKind.Sequential)]
        public struct RECT { public int Left, Top, Right, Bottom; }
        [StructLayout(LayoutKind.Sequential, Pack = 1)]
        public struct BLENDFUNCTION { public byte BlendOp, BlendFlags, SourceConstantAlpha, AlphaFormat; }

        public delegate bool EnumProc(IntPtr hwnd, IntPtr lParam);
        public delegate void WinEventProc(IntPtr hook, uint ev, IntPtr hwnd, int idObject, int idChild, uint thread, uint time);

        [DllImport("user32.dll")] public static extern bool UpdateLayeredWindow(IntPtr hwnd, IntPtr hdcDst, ref POINT pptDst, ref SIZE psize, IntPtr hdcSrc, ref POINT pptSrc, int crKey, ref BLENDFUNCTION pblend, int dwFlags);
        [DllImport("user32.dll")] public static extern IntPtr GetDC(IntPtr hwnd);
        [DllImport("user32.dll")] public static extern int ReleaseDC(IntPtr hwnd, IntPtr dc);
        [DllImport("gdi32.dll")] public static extern IntPtr CreateCompatibleDC(IntPtr dc);
        [DllImport("gdi32.dll")] public static extern bool DeleteDC(IntPtr dc);
        [DllImport("gdi32.dll")] public static extern IntPtr SelectObject(IntPtr dc, IntPtr obj);
        [DllImport("gdi32.dll")] public static extern bool DeleteObject(IntPtr obj);
        [DllImport("gdi32.dll")] public static extern IntPtr CreateRoundRectRgn(int l, int t, int r, int b, int w, int h);
        [DllImport("user32.dll")] public static extern int SetWindowRgn(IntPtr hwnd, IntPtr rgn, bool redraw);
        [DllImport("user32.dll")] public static extern bool EnumWindows(EnumProc f, IntPtr lParam);
        [DllImport("user32.dll", CharSet = CharSet.Unicode)] public static extern int GetWindowText(IntPtr hwnd, StringBuilder s, int n);
        [DllImport("user32.dll", CharSet = CharSet.Unicode)] public static extern int GetWindowTextLength(IntPtr hwnd);
        [DllImport("user32.dll")] public static extern bool IsWindowVisible(IntPtr hwnd);
        [DllImport("user32.dll")] public static extern bool IsWindow(IntPtr hwnd);
        [DllImport("user32.dll")] public static extern bool IsIconic(IntPtr hwnd);
        [DllImport("user32.dll")] public static extern bool IsZoomed(IntPtr hwnd);
        [DllImport("user32.dll")] public static extern uint GetWindowThreadProcessId(IntPtr hwnd, out uint pid);
        [DllImport("user32.dll")] public static extern bool ShowWindow(IntPtr hwnd, int cmd);
        [DllImport("user32.dll", SetLastError = true)] public static extern bool SetWindowPos(IntPtr hwnd, IntPtr after, int x, int y, int w, int h, uint flags);
        [DllImport("user32.dll")] public static extern bool GetWindowRect(IntPtr hwnd, out RECT r);
        [DllImport("user32.dll")] public static extern int GetWindowLong(IntPtr hwnd, int index);
        [DllImport("user32.dll")] public static extern int SetWindowLong(IntPtr hwnd, int index, int value);
        [DllImport("user32.dll")] public static extern IntPtr GetForegroundWindow();
        [DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr hwnd);
        [DllImport("user32.dll")] public static extern IntPtr GetWindow(IntPtr hwnd, uint cmd);
        [DllImport("user32.dll")] public static extern bool RegisterHotKey(IntPtr hwnd, int id, uint mods, uint vk);
        [DllImport("user32.dll")] public static extern bool UnregisterHotKey(IntPtr hwnd, int id);
        [DllImport("user32.dll")] public static extern bool ReleaseCapture();
        [DllImport("user32.dll")] public static extern IntPtr SendMessage(IntPtr hwnd, int msg, IntPtr w, IntPtr l);
        [DllImport("user32.dll")] public static extern bool PostMessage(IntPtr hwnd, int msg, IntPtr w, IntPtr l);
        [DllImport("user32.dll", CharSet = CharSet.Unicode)] public static extern int RegisterWindowMessage(string name);
        [DllImport("user32.dll")] public static extern IntPtr MonitorFromPoint(POINT pt, uint flags);
        [DllImport("shcore.dll")] public static extern int GetDpiForMonitor(IntPtr monitor, int type, out uint x, out uint y);
        [DllImport("user32.dll")] public static extern bool SetProcessDpiAwarenessContext(IntPtr value);
        [DllImport("user32.dll")] public static extern bool PrintWindow(IntPtr hwnd, IntPtr dc, uint flags);
        [DllImport("dwmapi.dll")] public static extern int DwmGetWindowAttribute(IntPtr hwnd, int attr, out int value, int size);
        [DllImport("user32.dll")] public static extern IntPtr SetWinEventHook(uint min, uint max, IntPtr module, WinEventProc f, uint pid, uint tid, uint flags);
        [DllImport("user32.dll")] public static extern bool UnhookWinEvent(IntPtr hook);

        public const int GWL_STYLE = -16, GWL_EXSTYLE = -20;
        public const int WS_CAPTION = 0x00C00000, WS_THICKFRAME = 0x00040000;
        public const int WS_EX_DLGMODALFRAME = 0x1, WS_EX_TOPMOST = 0x8, WS_EX_TOOLWINDOW = 0x80,
                         WS_EX_WINDOWEDGE = 0x100, WS_EX_CLIENTEDGE = 0x200, WS_EX_STATICEDGE = 0x20000,
                         WS_EX_LAYERED = 0x80000;
        public const uint SWP_NOSIZE = 0x1, SWP_NOMOVE = 0x2, SWP_NOZORDER = 0x4, SWP_NOACTIVATE = 0x10,
                          SWP_FRAMECHANGED = 0x20, SWP_NOOWNERZORDER = 0x200;
        public static readonly IntPtr HWND_TOP = IntPtr.Zero,
                                      HWND_TOPMOST = new IntPtr(-1), HWND_NOTOPMOST = new IntPtr(-2),
                                      HWND_BROADCAST = new IntPtr(0xffff);
        public const uint GW_HWNDNEXT = 2;
        public const int SW_RESTORE = 9, SW_SHOWNOACTIVATE = 4, SW_MINIMIZE = 6;
        public const uint EVENT_SYSTEM_FOREGROUND = 3, EVENT_SYSTEM_MINIMIZESTART = 0x16,
                          EVENT_SYSTEM_MINIMIZEEND = 0x17, EVENT_OBJECT_LOCATIONCHANGE = 0x800B;

        public static string Title(IntPtr hwnd)
        {
            int n = GetWindowTextLength(hwnd);
            if (n <= 0) return "";
            StringBuilder sb = new StringBuilder(n + 1);
            GetWindowText(hwnd, sb, sb.Capacity);
            return sb.ToString();
        }

        public static Rectangle Rect(IntPtr hwnd)
        {
            RECT r;
            if (!GetWindowRect(hwnd, out r)) return Rectangle.Empty;
            return Rectangle.FromLTRB(r.Left, r.Top, r.Right, r.Bottom);
        }

        public static bool IsCloaked(IntPtr hwnd)
        {
            int v;
            try { return DwmGetWindowAttribute(hwnd, 14, out v, 4) == 0 && v != 0; }
            catch { return false; }
        }
    }

    // --------------------------------------------------------------- Réglages
    class Config
    {
        public string SourceProcess = "", SourceTitle = "", Color = "minuit";
        public int CropTop, CropBottom, CropLeft, CropRight;
        public int Scale = 100;
        public double PxPerMm;            // 0 = mesuré automatiquement sur l'écran
        public bool TopMost;
        public int PosX = int.MinValue, PosY = int.MinValue;
        public bool Welcomed;
        public bool AutoMirrorTo = true;  // ouvre MirrorTo en même temps que le widget

        public static string Folder
        {
            get { return Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "iPhoneBureau"); }
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
                    switch (k)
                    {
                        case "SourceProcess": c.SourceProcess = v; break;
                        case "SourceTitle": c.SourceTitle = v; break;
                        case "Couleur": c.Color = v; break;
                        case "RecadrageHaut": c.CropTop = Int(v, 0); break;
                        case "RecadrageBas": c.CropBottom = Int(v, 0); break;
                        case "RecadrageGauche": c.CropLeft = Int(v, 0); break;
                        case "RecadrageDroite": c.CropRight = Int(v, 0); break;
                        case "Echelle": c.Scale = Math.Max(50, Math.Min(300, Int(v, 100))); break;
                        case "PixelsParMm":
                            double d;
                            if (double.TryParse(v, NumberStyles.Float, CultureInfo.InvariantCulture, out d)) c.PxPerMm = d;
                            break;
                        case "PremierPlan": c.TopMost = v == "1"; break;
                        case "X": c.PosX = Int(v, int.MinValue); break;
                        case "Y": c.PosY = Int(v, int.MinValue); break;
                        case "Bienvenue": c.Welcomed = v == "1"; break;
                        case "OuvrirMirrorTo": c.AutoMirrorTo = v != "0"; break;
                    }
                }
            }
            catch { }
            return c;
        }

        static int Int(string v, int def)
        {
            int i;
            return int.TryParse(v, NumberStyles.Integer, CultureInfo.InvariantCulture, out i) ? i : def;
        }

        public void Save()
        {
            try
            {
                Directory.CreateDirectory(Folder);
                StringBuilder sb = new StringBuilder();
                sb.AppendLine("; Réglages d'iPhone Bureau (modifiables aussi par clic droit sur le widget)");
                sb.AppendLine("SourceProcess=" + SourceProcess);
                sb.AppendLine("SourceTitle=" + SourceTitle);
                sb.AppendLine("Couleur=" + Color);
                sb.AppendLine("RecadrageHaut=" + CropTop);
                sb.AppendLine("RecadrageBas=" + CropBottom);
                sb.AppendLine("RecadrageGauche=" + CropLeft);
                sb.AppendLine("RecadrageDroite=" + CropRight);
                sb.AppendLine("Echelle=" + Scale);
                sb.AppendLine("PixelsParMm=" + PxPerMm.ToString("0.###", CultureInfo.InvariantCulture));
                sb.AppendLine("PremierPlan=" + (TopMost ? "1" : "0"));
                if (PosX != int.MinValue) sb.AppendLine("X=" + PosX);
                if (PosY != int.MinValue) sb.AppendLine("Y=" + PosY);
                sb.AppendLine("Bienvenue=" + (Welcomed ? "1" : "0"));
                sb.AppendLine("OuvrirMirrorTo=" + (AutoMirrorTo ? "1" : "0"));
                File.WriteAllText(FilePath, sb.ToString(), Encoding.UTF8);
            }
            catch { }
        }
    }

    // ------------------------------------------------------------- Géométrie
    // Cotes Apple de l'iPhone 13 mini : 131,5 × 64,2 mm, écran 5,4" 2340 × 1080 à 476 ppp.
    class Layout
    {
        public const double BodyW = 64.2, BodyH = 131.5, ScreenW = 1080 / 476.0 * 25.4;
        public const double BodyR = 10.3, ScreenR = 6.9, Edge = 0.85, NotchW = 26.0, NotchH = 5.0;

        public readonly double Ppm;
        public readonly Size Size;
        public readonly RectangleF Body;
        public readonly Rectangle Screen;
        public readonly float BodyRadius, ScreenRadius;

        public Layout(double ppm)
        {
            Ppm = ppm;
            int sw = (int)Math.Round(ScreenW * ppm);
            int sh = (int)Math.Round(sw * 2340.0 / 1080.0);
            float bw = (float)(BodyW * ppm), bh = (float)(BodyH * ppm);
            int margin = (int)Math.Ceiling(Math.Max(3.5 * ppm, 10));
            int shadow = (int)Math.Ceiling(2.5 * ppm);
            Size = new Size((int)Math.Ceiling(bw) + 2 * margin, (int)Math.Ceiling(bh) + 2 * margin + shadow);
            Body = new RectangleF(margin, margin, bw, bh);
            Screen = new Rectangle((int)Math.Round(margin + (bw - sw) / 2f), (int)Math.Round(margin + (bh - sh) / 2f), sw, sh);
            BodyRadius = Mm(BodyR);
            ScreenRadius = Mm(ScreenR);
        }

        public float Mm(double mm) { return (float)(mm * Ppm); }
    }

    class Scheme
    {
        public string Id, Label;
        public Color Mid, Light, Dark;
        public Scheme(string id, string label, int mid, int light, int dark)
        {
            Id = id; Label = label;
            Mid = Color.FromArgb(mid | unchecked((int)0xFF000000));
            Light = Color.FromArgb(light | unchecked((int)0xFF000000));
            Dark = Color.FromArgb(dark | unchecked((int)0xFF000000));
        }

        // Les six finitions de l'iPhone 13 mini.
        public static readonly Scheme[] All = new Scheme[]
        {
            new Scheme("minuit", "Minuit", 0x2E3238, 0x5A616B, 0x15181C),
            new Scheme("lumiere", "Lumière stellaire", 0xD9D2C6, 0xF6F1E8, 0xA69E90),
            new Scheme("bleu", "Bleu", 0x2C4F6E, 0x5C86AA, 0x16293B),
            new Scheme("rose", "Rose", 0xEACACB, 0xFBE7E6, 0xBE9A9B),
            new Scheme("vert", "Vert", 0x3D4E3C, 0x6C8268, 0x1E281E),
            new Scheme("rouge", "(PRODUCT)RED", 0xB3192C, 0xE04A58, 0x6E0E19),
        };

        public static Scheme Find(string id)
        {
            foreach (Scheme s in All) if (s.Id == id) return s;
            return All[0];
        }
    }

    class HotSpot
    {
        public RectangleF Rect;
        public string Action;
        public HotSpot(RectangleF r, string a) { Rect = r; Action = a; }
    }

    enum ScreenState { Mirror, NoSource, Asleep }

    // ----------------------------------------------------------------- Dessin
    static class Renderer
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

        public static Bitmap Draw(Layout L, Scheme s, ScreenState state, List<HotSpot> spots, DateTime now, bool hasMirrorTo)
        {
            Bitmap bmp = new Bitmap(L.Size.Width, L.Size.Height, PixelFormat.Format32bppArgb);
            using (Graphics g = Graphics.FromImage(bmp))
            {
                g.SmoothingMode = SmoothingMode.AntiAlias;
                g.PixelOffsetMode = PixelOffsetMode.HighQuality;
                g.TextRenderingHint = TextRenderingHint.AntiAliasGridFit;
                DrawBody(g, L, s, state == ScreenState.Mirror);
                if (state != ScreenState.Mirror) DrawScreen(g, L, state, spots, now, hasMirrorTo);
                DrawNotch(g, L);
            }
            return bmp;
        }

        static void DrawBody(Graphics g, Layout L, Scheme s, bool hole)
        {
            RectangleF body = L.Body;
            using (GraphicsPath screen = RoundRect(L.Screen, L.ScreenRadius))
            {
                // Ombre portée, jamais sous l'écran (le trou doit rester vraiment transparent).
                int layers = 14;
                for (int i = layers; i >= 1; i--)
                {
                    float grow = L.Mm(0.22 * i);
                    RectangleF r = new RectangleF(body.X - grow, body.Y - grow + L.Mm(1.1), body.Width + 2 * grow, body.Height + 2 * grow);
                    using (GraphicsPath p = RoundRect(r, L.BodyRadius + grow))
                    using (SolidBrush b = new SolidBrush(Color.FromArgb(9, 0, 0, 0)))
                    {
                        if (hole) { p.AddPath(screen, false); p.FillMode = FillMode.Alternate; }
                        g.FillPath(b, p);
                    }
                }

                // Boutons latéraux : vibreur et volume à gauche, bouton latéral à droite.
                float bt = L.Mm(0.9), proud = L.Mm(0.55);
                DrawButton(g, s, new RectangleF(body.X - proud, body.Y + L.Mm(19), bt, L.Mm(5.5)), L);
                DrawButton(g, s, new RectangleF(body.X - proud, body.Y + L.Mm(30), bt, L.Mm(9.5)), L);
                DrawButton(g, s, new RectangleF(body.X - proud, body.Y + L.Mm(42.5), bt, L.Mm(9.5)), L);
                DrawButton(g, s, new RectangleF(body.Right + proud - bt, body.Y + L.Mm(33), bt, L.Mm(15.5)), L);

                // Contour aluminium.
                RectangleF glassR = Inset(body, L.Mm(Layout.Edge));
                using (GraphicsPath edge = RoundRect(body, L.BodyRadius))
                {
                    using (GraphicsPath inner = RoundRect(Inset(body, L.Mm(Layout.Edge + 0.25)), L.BodyRadius - L.Mm(Layout.Edge + 0.25)))
                        edge.AddPath(inner, false);
                    edge.FillMode = FillMode.Alternate;
                    using (LinearGradientBrush b = new LinearGradientBrush(body, s.Mid, s.Mid, LinearGradientMode.Horizontal))
                    {
                        ColorBlend cb = new ColorBlend();
                        cb.Colors = new Color[] { s.Dark, s.Light, s.Mid, s.Mid, s.Light, s.Dark };
                        cb.Positions = new float[] { 0f, 0.04f, 0.12f, 0.88f, 0.96f, 1f };
                        b.InterpolationColors = cb;
                        g.FillPath(b, edge);
                    }
                }
                using (GraphicsPath edgeLine = RoundRect(Inset(body, 0.5f), L.BodyRadius))
                using (Pen p = new Pen(Color.FromArgb(70, s.Light), Math.Max(1f, L.Mm(0.15))))
                    g.DrawPath(p, edgeLine);

                // Verre noir de la face avant, percé de l'écran.
                using (GraphicsPath glass = RoundRect(glassR, L.BodyRadius - L.Mm(Layout.Edge)))
                {
                    if (hole) { glass.AddPath(screen, false); glass.FillMode = FillMode.Alternate; }
                    using (SolidBrush b = new SolidBrush(Color.FromArgb(255, 6, 6, 8)))
                        g.FillPath(b, glass);
                }
                using (GraphicsPath shine = RoundRect(Inset(glassR, L.Mm(0.12)), L.BodyRadius - L.Mm(Layout.Edge + 0.12)))
                using (Pen p = new Pen(Color.FromArgb(38, 255, 255, 255), Math.Max(1f, L.Mm(0.1))))
                    g.DrawPath(p, shine);
            }
        }

        static void DrawButton(Graphics g, Scheme s, RectangleF r, Layout L)
        {
            using (GraphicsPath p = RoundRect(r, r.Width / 2))
            using (LinearGradientBrush b = new LinearGradientBrush(r, s.Light, s.Dark, LinearGradientMode.Horizontal))
                g.FillPath(b, p);
        }

        public static void DrawNotch(Graphics g, Layout L)
        {
            RectangleF S = L.Screen;
            float w = L.Mm(Layout.NotchW), h = L.Mm(Layout.NotchH), r = L.Mm(2.5), f = L.Mm(0.8);
            float x = S.X + (S.Width - w) / 2, top = S.Y - 1, bottom = S.Y + h;
            using (GraphicsPath p = new GraphicsPath())
            {
                p.AddArc(x - 2 * f, top, 2 * f, 2 * f, 270, 90);
                p.AddArc(x, bottom - 2 * r, 2 * r, 2 * r, 180, -90);
                p.AddArc(x + w - 2 * r, bottom - 2 * r, 2 * r, 2 * r, 90, -90);
                p.AddArc(x + w, top, 2 * f, 2 * f, 180, 90);
                p.CloseFigure();
                using (SolidBrush b = new SolidBrush(Color.FromArgb(255, 6, 6, 8)))
                    g.FillPath(b, p);
            }
            // Haut-parleur et caméra frontale.
            float sw = L.Mm(7), sh = Math.Max(1.5f, L.Mm(0.65));
            RectangleF speaker = new RectangleF(S.X + (S.Width - sw) / 2, S.Y + L.Mm(1.0), sw, sh);
            using (GraphicsPath p = RoundRect(speaker, sh / 2))
            using (SolidBrush b = new SolidBrush(Color.FromArgb(255, 30, 31, 34)))
                g.FillPath(b, p);
            float cd = Math.Max(2f, L.Mm(1.7));
            RectangleF cam = new RectangleF(speaker.Right + L.Mm(3.2), speaker.Y + sh / 2 - cd / 2 + L.Mm(0.6), cd, cd);
            using (SolidBrush b = new SolidBrush(Color.FromArgb(255, 14, 18, 30)))
                g.FillEllipse(b, cam);
            using (SolidBrush b = new SolidBrush(Color.FromArgb(120, 70, 90, 160)))
                g.FillEllipse(b, cam.X + cd * 0.25f, cam.Y + cd * 0.2f, cd * 0.3f, cd * 0.3f);
        }

        static Font F(float px, FontStyle st) { return new Font("Segoe UI", Math.Max(6f, px), st, GraphicsUnit.Pixel); }
        static Font FLight(float px) { return new Font("Segoe UI Light", Math.Max(6f, px), FontStyle.Regular, GraphicsUnit.Pixel); }
        static Font FSemi(float px) { return new Font("Segoe UI Semibold", Math.Max(6f, px), FontStyle.Regular, GraphicsUnit.Pixel); }

        // Écran affiché quand aucune recopie n'est branchée (ou quand elle est en veille).
        static void DrawScreen(Graphics g, Layout L, ScreenState state, List<HotSpot> spots, DateTime now, bool hasMirrorTo)
        {
            RectangleF S = L.Screen;
            float W = S.Width, H = S.Height;
            using (GraphicsPath clip = RoundRect(S, L.ScreenRadius))
            {
                g.SetClip(clip);

                using (LinearGradientBrush b = new LinearGradientBrush(S, Color.Black, Color.Black, LinearGradientMode.Vertical))
                {
                    ColorBlend cb = new ColorBlend();
                    cb.Colors = new Color[] { Color.FromArgb(14, 26, 64), Color.FromArgb(52, 36, 116), Color.FromArgb(150, 64, 128), Color.FromArgb(232, 128, 120) };
                    cb.Positions = new float[] { 0f, 0.42f, 0.78f, 1f };
                    b.InterpolationColors = cb;
                    g.FillRectangle(b, S);
                }
                Blob(g, S.X - W * 0.25f, S.Y + H * 0.05f, W * 0.9f, Color.FromArgb(150, 60, 120, 255));
                Blob(g, S.X + W * 0.45f, S.Y + H * 0.48f, W * 0.95f, Color.FromArgb(130, 255, 110, 170));
                Blob(g, S.X - W * 0.1f, S.Y + H * 0.62f, W * 0.7f, Color.FromArgb(110, 90, 220, 255));
                if (state == ScreenState.Asleep)
                    using (SolidBrush dim = new SolidBrush(Color.FromArgb(120, 0, 0, 0))) g.FillRectangle(dim, S);

                StringFormat center = new StringFormat();
                center.Alignment = StringAlignment.Center;
                center.LineAlignment = StringAlignment.Center;

                // Barre d'état : heure à gauche de l'encoche, réseau et batterie à droite.
                float notchW = L.Mm(Layout.NotchW), barH = L.Mm(Layout.NotchH);
                float sideW = (W - notchW) / 2;
                using (Font f = FSemi(W * 0.042f))
                    g.DrawString(now.ToString("HH:mm"), f, Brushes.White, new RectangleF(S.X + sideW * 0.12f, S.Y + barH * 0.08f, sideW * 0.88f, barH), center);
                float rx = S.Right - sideW * 0.86f, cy = S.Y + barH * 0.58f, u = W * 0.011f;
                for (int i = 0; i < 4; i++)
                {
                    float bh = u * (1.1f + i * 0.55f);
                    g.FillRectangle(Brushes.White, rx + i * u * 1.45f, cy + u * 1.6f - bh, u, bh);
                }
                RectangleF bat = new RectangleF(rx + u * 7.4f, cy - u * 1.35f, u * 5.6f, u * 2.9f);
                using (GraphicsPath bp = RoundRect(bat, u * 0.8f))
                using (Pen p = new Pen(Color.FromArgb(150, 255, 255, 255), Math.Max(1f, u * 0.28f)))
                    g.DrawPath(p, bp);
                using (GraphicsPath bp = RoundRect(Inset(bat, u * 0.5f), u * 0.4f))
                    g.FillPath(Brushes.White, bp);
                g.FillRectangle(Brushes.White, bat.Right + u * 0.25f, bat.Y + bat.Height * 0.32f, u * 0.4f, bat.Height * 0.36f);

                // Date et grande heure façon écran verrouillé.
                string date = now.ToString("dddd d MMMM", Fr);
                date = char.ToUpper(date[0], Fr) + date.Substring(1);
                using (Font f = FSemi(W * 0.05f))
                    g.DrawString(date, f, Brushes.White, new RectangleF(S.X, S.Y + H * 0.085f, W, H * 0.05f), center);
                using (Font f = FLight(W * 0.215f))
                    g.DrawString(now.ToString("HH:mm"), f, Brushes.White, new RectangleF(S.X, S.Y + H * 0.125f, W, H * 0.14f), center);

                if (state == ScreenState.Asleep)
                {
                    RectangleF card = new RectangleF(S.X + W * 0.1f, S.Y + H * 0.6f, W * 0.8f, H * 0.13f);
                    Card(g, card, W);
                    using (Font f = FSemi(W * 0.05f))
                        g.DrawString("Écran en veille", f, Brushes.White, new RectangleF(card.X, card.Y + card.Height * 0.1f, card.Width, card.Height * 0.45f), center);
                    using (Font f = F(W * 0.038f, FontStyle.Regular))
                    using (SolidBrush b = new SolidBrush(Color.FromArgb(215, 255, 255, 255)))
                        g.DrawString("Cliquez pour le réveiller", f, b, new RectangleF(card.X, card.Y + card.Height * 0.5f, card.Width, card.Height * 0.4f), center);
                    spots.Add(new HotSpot(S, "reveiller"));
                }
                else
                {
                    RectangleF card = new RectangleF(S.X + W * 0.06f, S.Y + H * 0.36f, W * 0.88f, H * 0.535f);
                    Card(g, card, W);
                    float pad = W * 0.06f, y = card.Y + pad * 0.8f, cw = card.Width - 2 * pad;
                    using (Font f = FSemi(W * 0.058f))
                    {
                        g.DrawString("Connecter l'iPhone", f, Brushes.White, new RectangleF(card.X + pad, y, cw, W * 0.09f));
                        y += W * 0.1f;
                    }
                    string[] steps = new string[]
                    {
                        "1. Touchez « Recopie gratuite » ci-dessous : un code s'affiche ici.",
                        "2. Sur l'iPhone, appli AirDroid Cast (gratuite) : tapez ce code.",
                        "3. Acceptez ici, puis « Démarrer la diffusion » sur l'iPhone.",
                    };
                    using (Font f = F(W * 0.04f, FontStyle.Regular))
                    using (SolidBrush b = new SolidBrush(Color.FromArgb(230, 255, 255, 255)))
                    {
                        foreach (string st in steps)
                        {
                            SizeF sz = g.MeasureString(st, f, (int)cw);
                            g.DrawString(st, f, b, new RectangleF(card.X + pad, y, cw, sz.Height + 2));
                            y += sz.Height + W * 0.018f;
                        }
                    }
                    y += W * 0.02f;
                    string[][] buttons = new string[][]
                    {
                        new string[] { "Recopie gratuite", "webcast" },
                        new string[] { "Choisir la fenêtre…", "choisir" },
                        new string[] { "Messages (Lien mobile)", "liens" },
                    };
                    float bh = W * 0.105f, gap = W * 0.03f;
                    float room = card.Bottom - pad * 0.7f - y;
                    float needed = buttons.Length * bh + (buttons.Length - 1) * gap;
                    if (room > needed) y += room - needed;
                    for (int i = 0; i < buttons.Length; i++)
                    {
                        RectangleF br = new RectangleF(card.X + pad, y, cw, bh);
                        bool primary = i == 0;
                        using (GraphicsPath p = RoundRect(br, bh / 2))
                        using (SolidBrush b = new SolidBrush(primary ? Color.FromArgb(240, 255, 255, 255) : Color.FromArgb(55, 255, 255, 255)))
                            g.FillPath(b, p);
                        using (Font f = FSemi(W * 0.042f))
                        using (SolidBrush b = new SolidBrush(primary ? Color.FromArgb(255, 40, 30, 90) : Color.White))
                            g.DrawString(buttons[i][0], f, b, br, center);
                        spots.Add(new HotSpot(br, buttons[i][1]));
                        y += bh + gap;
                    }
                }

                // Barre d'accueil.
                float hw = W * 0.36f, hh = Math.Max(2f, L.Mm(0.75));
                RectangleF home = new RectangleF(S.X + (W - hw) / 2, S.Bottom - L.Mm(1.6) - hh, hw, hh);
                using (GraphicsPath p = RoundRect(home, hh / 2))
                using (SolidBrush b = new SolidBrush(Color.FromArgb(220, 255, 255, 255)))
                    g.FillPath(b, p);

                g.ResetClip();
            }
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

        static void Card(Graphics g, RectangleF r, float W)
        {
            using (GraphicsPath p = RoundRect(r, W * 0.06f))
            {
                using (SolidBrush b = new SolidBrush(Color.FromArgb(46, 255, 255, 255))) g.FillPath(b, p);
                using (Pen pen = new Pen(Color.FromArgb(70, 255, 255, 255), Math.Max(1f, W * 0.004f))) g.DrawPath(pen, p);
            }
        }

        // Petite icône de téléphone pour la zone de notification et les raccourcis.
        public static Bitmap Icon(int size)
        {
            Bitmap bmp = new Bitmap(size, size, PixelFormat.Format32bppArgb);
            using (Graphics g = Graphics.FromImage(bmp))
            {
                g.SmoothingMode = SmoothingMode.AntiAlias;
                float h = size * 0.94f, w = h * 0.5f;
                RectangleF body = new RectangleF((size - w) / 2, (size - h) / 2, w, h);
                using (GraphicsPath p = RoundRect(body, w * 0.22f))
                using (SolidBrush b = new SolidBrush(Color.FromArgb(255, 30, 32, 38)))
                    g.FillPath(b, p);
                float e = Math.Max(1f, w * 0.08f);
                RectangleF scr = new RectangleF(body.X + e, body.Y + e, body.Width - 2 * e, body.Height - 2 * e);
                using (GraphicsPath p = RoundRect(scr, w * 0.15f))
                using (LinearGradientBrush b = new LinearGradientBrush(scr, Color.FromArgb(70, 110, 255), Color.FromArgb(240, 110, 150), LinearGradientMode.ForwardDiagonal))
                    g.FillPath(b, p);
                if (size >= 32)
                {
                    float nw = scr.Width * 0.45f, nh = Math.Max(1f, scr.Height * 0.035f);
                    using (SolidBrush b = new SolidBrush(Color.FromArgb(255, 30, 32, 38)))
                        g.FillRectangle(b, scr.X + (scr.Width - nw) / 2, scr.Y, nw, nh);
                }
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

    // ------------------------------------------------- Recherche de la recopie
    class Candidate
    {
        public IntPtr Hwnd;
        public string Title, Process;
        public uint Pid;
        public Rectangle Rect;
        public override string ToString() { return Title + "   (" + Process + ")"; }
    }

    static class Finder
    {
        // Applis connues pour recevoir la recopie d'écran d'un iPhone sous Windows.
        static readonly string[] Keywords = new string[]
        {
            "mirrorto", "airdroid", "apowermirror", "letsview", "uxplay", "lonelyscreen",
            "airserver", "5kplayer", "reflector", "phonemirror", "airplay"
        };
        static readonly string[] Browsers = new string[] { "chrome", "msedge", "firefox", "opera", "brave", "explorer", "vivaldi" };

        public static List<Candidate> List()
        {
            List<Candidate> list = new List<Candidate>();
            uint self = (uint)Process.GetCurrentProcess().Id;
            Dictionary<uint, string> names = new Dictionary<uint, string>();
            N.EnumWindows(delegate(IntPtr h, IntPtr l)
            {
                if (!N.IsWindowVisible(h) || N.IsCloaked(h)) return true;
                if ((N.GetWindowLong(h, N.GWL_EXSTYLE) & N.WS_EX_TOOLWINDOW) != 0) return true;
                string title = N.Title(h);
                if (title.Length == 0) return true;
                uint pid;
                N.GetWindowThreadProcessId(h, out pid);
                if (pid == self) return true;
                Rectangle r = N.Rect(h);
                if (!N.IsIconic(h) && (r.Width < 80 || r.Height < 80)) return true;
                string name;
                if (!names.TryGetValue(pid, out name))
                {
                    try { name = Process.GetProcessById((int)pid).ProcessName; } catch { name = ""; }
                    names[pid] = name;
                }
                Candidate c = new Candidate();
                c.Hwnd = h; c.Title = title; c.Process = name; c.Pid = pid; c.Rect = r;
                list.Add(c);
                return true;
            }, IntPtr.Zero);
            return list;
        }

        public static Candidate Find(Config cfg)
        {
            Candidate best = null;
            double bestScore = 0;
            foreach (Candidate c in List())
            {
                double score = 0;
                string title = c.Title.ToLowerInvariant(), proc = c.Process.ToLowerInvariant();
                bool portrait = c.Rect.Height > c.Rect.Width;
                if (cfg.SourceProcess.Length > 0)
                {
                    // Fenêtre choisie à la main : même programme, de préférence même titre.
                    if (!string.Equals(c.Process, cfg.SourceProcess, StringComparison.OrdinalIgnoreCase)) continue;
                    // Dans un navigateur, seul l'onglet ou l'appli au bon titre compte, jamais une autre fenêtre.
                    if (Array.IndexOf(Browsers, proc) >= 0 && cfg.SourceTitle.Length > 0
                        && c.Title.IndexOf(cfg.SourceTitle, StringComparison.OrdinalIgnoreCase) < 0) continue;
                    score = 10;
                    if (c.Title == cfg.SourceTitle) score += 10;
                    else if (cfg.SourceTitle.Length > 0 && c.Title.IndexOf(cfg.SourceTitle, StringComparison.OrdinalIgnoreCase) >= 0) score += 5;
                    if (portrait) score += 2;
                }
                else
                {
                    bool byProc = false, byTitle = false;
                    foreach (string k in Keywords)
                    {
                        if (proc.Contains(k)) byProc = true;
                        if (title.Contains(k)) byTitle = true;
                    }
                    if (byTitle && Array.IndexOf(Browsers, proc) >= 0) byTitle = false;
                    if (!byProc && !byTitle) continue;
                    bool iphone = title.Contains("iphone");
                    // On ne s'accroche qu'à une vraie fenêtre de recopie, pas au tableau de bord de l'appli.
                    if (!portrait && !iphone) continue;
                    score = (byProc ? 10 : 8) + (iphone ? 5 : 0) + (portrait ? 2 : 0);
                }
                score += Math.Min(1.0, c.Rect.Width * (double)c.Rect.Height / 1e7);
                if (score > bestScore) { bestScore = score; best = c; }
            }
            return best;
        }
    }

    // ------------------------------------------------------ iMyFone MirrorTo
    // L'appli de recopie conseillée : elle affiche l'iPhone et le pilote par Bluetooth.
    static class MirrorTo
    {
        static string cached;
        static DateTime cachedAt = DateTime.MinValue;

        public static string FindExe()
        {
            if ((DateTime.Now - cachedAt).TotalSeconds < 30) return cached;
            cachedAt = DateTime.Now;
            cached = Locate();
            return cached;
        }

        static string Locate()
        {
            string[] roots = new string[]
            {
                @"Software\Microsoft\Windows\CurrentVersion\Uninstall",
                @"Software\WOW6432Node\Microsoft\Windows\CurrentVersion\Uninstall"
            };
            RegistryKey[] hives = new RegistryKey[] { Registry.CurrentUser, Registry.LocalMachine };
            foreach (RegistryKey hive in hives)
                foreach (string root in roots)
                {
                    try
                    {
                        using (RegistryKey k = hive.OpenSubKey(root))
                        {
                            if (k == null) continue;
                            foreach (string name in k.GetSubKeyNames())
                                using (RegistryKey app = k.OpenSubKey(name))
                                {
                                    string display = app == null ? null : app.GetValue("DisplayName") as string;
                                    if (display == null || display.IndexOf("MirrorTo", StringComparison.OrdinalIgnoreCase) < 0) continue;
                                    string exe = FromFolder(app.GetValue("InstallLocation") as string);
                                    if (exe != null) return exe;
                                    string icon = app.GetValue("DisplayIcon") as string;
                                    if (icon != null)
                                    {
                                        icon = icon.Split(',')[0].Trim('"');
                                        if (icon.EndsWith(".exe", StringComparison.OrdinalIgnoreCase) && File.Exists(icon)) return icon;
                                        exe = FromFolder(Path.GetDirectoryName(icon));
                                        if (exe != null) return exe;
                                    }
                                }
                        }
                    }
                    catch { }
                }
            return null;
        }

        static string FromFolder(string dir)
        {
            try
            {
                if (string.IsNullOrEmpty(dir)) return null;
                dir = dir.Trim('"');
                if (!Directory.Exists(dir)) return null;
                string fallback = null;
                foreach (string f in Directory.GetFiles(dir, "*.exe"))
                {
                    string n = Path.GetFileNameWithoutExtension(f).ToLowerInvariant();
                    if (n.Contains("unins") || n.Contains("update") || n.Contains("crash") || n.Contains("helper")) continue;
                    if (n.Contains("mirrorto")) return f;
                    if (fallback == null && n.Contains("mirror")) fallback = f;
                }
                return fallback;
            }
            catch { return null; }
        }

        public static bool Running()
        {
            foreach (Process p in Process.GetProcesses())
            {
                string n;
                try { n = p.ProcessName; } catch { continue; }
                if (n.IndexOf("mirrorto", StringComparison.OrdinalIgnoreCase) >= 0) return true;
            }
            return false;
        }

        public static bool Launch()
        {
            string exe = FindExe();
            if (exe == null) return false;
            try
            {
                ProcessStartInfo psi = new ProcessStartInfo(exe);
                psi.WorkingDirectory = Path.GetDirectoryName(exe);
                Process.Start(psi);
                return true;
            }
            catch { return false; }
        }
    }

    // ---------------------------------------------------- AirDroid Cast Web
    // Recopie gratuite sans logiciel sur le PC : la page web reçoit l'écran envoyé par
    // l'appli AirDroid Cast de l'iPhone. Ouverte dans Edge en mode appli (sans onglets).
    static class WebCast
    {
        public const string Title = "AirDroid Cast";
        const string Url = "https://webcast.airdroid.com/";

        public static bool Launch()
        {
            foreach (Candidate c in Finder.List())
                if (c.Process.Equals("msedge", StringComparison.OrdinalIgnoreCase) && c.Title.IndexOf(Title, StringComparison.OrdinalIgnoreCase) >= 0)
                    return true; // déjà ouverte
            try
            {
                Process.Start("msedge.exe", "--app=" + Url + " --window-size=420,900");
                return true;
            }
            catch { return false; }
        }
    }

    // ---------------------------------------------- Fenêtre de recopie pilotée
    class Mirror
    {
        public IntPtr Hwnd = IntPtr.Zero;
        public string Title = "", Process = "";
        public uint Pid;
        int origStyle, origEx;
        Rectangle origRect, lastTarget, settled;
        bool origTopMost;
        string rgnKey = "";

        public bool Blocked;  // Windows refuse de déplacer la fenêtre (appli lancée en administrateur)
        public bool Attached { get { return Hwnd != IntPtr.Zero; } }
        public bool Alive { get { return Attached && N.IsWindow(Hwnd); } }
        public bool Iconic { get { return Attached && N.IsIconic(Hwnd); } }

        public void Attach(Candidate c)
        {
            Hwnd = c.Hwnd; Title = c.Title; Process = c.Process; Pid = c.Pid;
            if (N.IsIconic(Hwnd) || N.IsZoomed(Hwnd)) N.ShowWindow(Hwnd, N.SW_RESTORE);
            origStyle = N.GetWindowLong(Hwnd, N.GWL_STYLE);
            origEx = N.GetWindowLong(Hwnd, N.GWL_EXSTYLE);
            origTopMost = (origEx & N.WS_EX_TOPMOST) != 0;
            origRect = N.Rect(Hwnd);
            // Sans barre de titre ni bordure : la fenêtre ne montre plus que l'image de l'iPhone.
            N.SetWindowLong(Hwnd, N.GWL_STYLE, origStyle & ~(N.WS_CAPTION | N.WS_THICKFRAME));
            N.SetWindowLong(Hwnd, N.GWL_EXSTYLE, origEx & ~(N.WS_EX_DLGMODALFRAME | N.WS_EX_WINDOWEDGE | N.WS_EX_CLIENTEDGE | N.WS_EX_STATICEDGE));
            N.SetWindowPos(Hwnd, IntPtr.Zero, 0, 0, 0, 0, N.SWP_NOMOVE | N.SWP_NOSIZE | N.SWP_NOZORDER | N.SWP_NOACTIVATE | N.SWP_FRAMECHANGED);
            lastTarget = Rectangle.Empty; settled = Rectangle.Empty; rgnKey = "";
            Blocked = false;
        }

        // Rend la fenêtre telle qu'on l'a trouvée.
        public void Detach()
        {
            if (!Attached) return;
            if (N.IsWindow(Hwnd))
            {
                N.SetWindowRgn(Hwnd, IntPtr.Zero, true);
                N.SetWindowLong(Hwnd, N.GWL_STYLE, origStyle);
                N.SetWindowLong(Hwnd, N.GWL_EXSTYLE, origEx);
                N.SetWindowPos(Hwnd, origTopMost ? N.HWND_TOPMOST : N.HWND_NOTOPMOST, origRect.X, origRect.Y, origRect.Width, origRect.Height,
                    N.SWP_NOACTIVATE | N.SWP_FRAMECHANGED | N.SWP_NOOWNERZORDER);
            }
            Hwnd = IntPtr.Zero;
        }

        public void Forget() { Hwnd = IntPtr.Zero; }

        // Cale la fenêtre sous le trou de l'écran. Le recadrage cache les barres d'outils de l'appli.
        public void Place(Rectangle hole, int radius, Config cfg)
        {
            Rectangle target = new Rectangle(hole.X - cfg.CropLeft, hole.Y - cfg.CropTop,
                hole.Width + cfg.CropLeft + cfg.CropRight, hole.Height + cfg.CropTop + cfg.CropBottom);
            Rectangle cur = N.Rect(Hwnd);
            if (target != lastTarget || cur != settled)
            {
                if (cur != target)
                {
                    if (!N.SetWindowPos(Hwnd, IntPtr.Zero, target.X, target.Y, target.Width, target.Height,
                        N.SWP_NOZORDER | N.SWP_NOACTIVATE | N.SWP_NOOWNERZORDER) && Marshal.GetLastWin32Error() == 5)
                        Blocked = true;
                    cur = N.Rect(Hwnd);
                }
                // Si l'appli impose sa propre taille, on l'accepte au lieu de lutter sans fin.
                settled = cur;
                lastTarget = target;
            }
            string key = cfg.CropLeft + "," + cfg.CropTop + "," + hole.Width + "," + hole.Height + "," + radius;
            if (key != rgnKey)
            {
                IntPtr rgn = N.CreateRoundRectRgn(cfg.CropLeft, cfg.CropTop, cfg.CropLeft + hole.Width + 1, cfg.CropTop + hole.Height + 1, radius * 2, radius * 2);
                if (N.SetWindowRgn(Hwnd, rgn, true) != 0) rgnKey = key;
                else N.DeleteObject(rgn);
            }
        }

        // Garde la fenêtre de recopie juste sous le cadre du téléphone.
        public void KeepBelow(IntPtr frame, bool topMost)
        {
            if (topMost && (N.GetWindowLong(Hwnd, N.GWL_EXSTYLE) & N.WS_EX_TOPMOST) == 0)
                N.SetWindowPos(Hwnd, N.HWND_TOPMOST, 0, 0, 0, 0, N.SWP_NOMOVE | N.SWP_NOSIZE | N.SWP_NOACTIVATE);
            if (IsAbove(Hwnd, frame))
                N.SetWindowPos(frame, topMost ? N.HWND_TOPMOST : N.HWND_TOP, 0, 0, 0, 0, N.SWP_NOMOVE | N.SWP_NOSIZE | N.SWP_NOACTIVATE);
            if (N.GetWindow(frame, N.GW_HWNDNEXT) != Hwnd)
                N.SetWindowPos(Hwnd, frame, 0, 0, 0, 0, N.SWP_NOMOVE | N.SWP_NOSIZE | N.SWP_NOACTIVATE | N.SWP_NOOWNERZORDER);
        }

        public void DropTopMost()
        {
            if (Attached) N.SetWindowPos(Hwnd, N.HWND_NOTOPMOST, 0, 0, 0, 0, N.SWP_NOMOVE | N.SWP_NOSIZE | N.SWP_NOACTIVATE);
        }

        static bool IsAbove(IntPtr a, IntPtr b)
        {
            IntPtr h = N.GetWindow(a, N.GW_HWNDNEXT);
            for (int n = 0; h != IntPtr.Zero && n < 5000; n++)
            {
                if (h == b) return true;
                h = N.GetWindow(h, N.GW_HWNDNEXT);
            }
            return false;
        }

        // Mesure les bandes noires autour de l'image (en pixels de la fenêtre).
        public bool MeasureBlackBars(out int top, out int bottom, out int left, out int right)
        {
            top = bottom = left = right = 0;
            Rectangle r = N.Rect(Hwnd);
            if (r.Width < 20 || r.Height < 20) return false;
            using (Bitmap bmp = new Bitmap(r.Width, r.Height, PixelFormat.Format32bppArgb))
            {
                using (Graphics g = Graphics.FromImage(bmp))
                {
                    IntPtr dc = g.GetHdc();
                    bool ok = N.PrintWindow(Hwnd, dc, 2);
                    g.ReleaseHdc(dc);
                    if (!ok) return false;
                }
                BitmapData data = bmp.LockBits(new Rectangle(0, 0, r.Width, r.Height), ImageLockMode.ReadOnly, PixelFormat.Format32bppArgb);
                int[] px = new int[r.Width * r.Height];
                Marshal.Copy(data.Scan0, px, 0, px.Length);
                bmp.UnlockBits(data);
                int w = r.Width, h = r.Height;
                Func<int, int, bool> lit = delegate(int x, int y)
                {
                    int c = px[y * w + x];
                    return ((c >> 16) & 255) > 28 || ((c >> 8) & 255) > 28 || (c & 255) > 28;
                };
                Func<int, bool> rowDark = delegate(int y)
                {
                    int n = 0;
                    for (int x = 0; x < w; x += 2) if (lit(x, y)) n++;
                    return n < w / 2 / 50 + 1;
                };
                Func<int, bool> colDark = delegate(int x)
                {
                    int n = 0;
                    for (int y = 0; y < h; y += 2) if (lit(x, y)) n++;
                    return n < h / 2 / 50 + 1;
                };
                while (top < h / 3 && rowDark(top)) top++;
                while (bottom < h / 3 && rowDark(h - 1 - bottom)) bottom++;
                while (left < w / 3 && colDark(left)) left++;
                while (right < w / 3 && colDark(w - 1 - right)) right++;
                return top < h / 3 && left < w / 3;
            }
        }
    }

    // --------------------------------------------------------------- Le widget
    class PhoneForm : Form
    {
        const int HOTKEY_ID = 0x1913;
        readonly int WM_SHOW_ME = N.RegisterWindowMessage("iPhoneBureau_Afficher");
        readonly int WM_QUIT_ME = N.RegisterWindowMessage("iPhoneBureau_Quitter");

        Config cfg;
        Layout L;
        Mirror mirror = new Mirror();
        NotifyIcon tray;
        ContextMenuStrip menu;
        System.Windows.Forms.Timer timer;
        List<HotSpot> spots = new List<HotSpot>();
        ScreenState shown = (ScreenState)(-1);
        int shownMinute = -1;
        DateTime lastSearch = DateTime.MinValue;
        N.WinEventProc winEvents;
        List<IntPtr> hooks = new List<IntPtr>();
        bool syncing, warnedBlocked;

        public PhoneForm()
        {
            cfg = Config.Load();
            FormBorderStyle = FormBorderStyle.None;
            ShowInTaskbar = false;
            StartPosition = FormStartPosition.Manual;
            Text = "iPhone Bureau";
            TopMost = cfg.TopMost;
            winEvents = OnWinEvent;

            BuildMenu();
            tray = new NotifyIcon();
            using (Bitmap b = Renderer.Icon(32)) tray.Icon = System.Drawing.Icon.FromHandle(b.GetHicon());
            tray.Text = "iPhone Bureau";
            tray.ContextMenuStrip = menu;
            tray.MouseClick += delegate(object s, MouseEventArgs e) { if (e.Button == MouseButtons.Left) ShowAll(); };
            tray.Visible = true;

            timer = new System.Windows.Forms.Timer();
            timer.Interval = 150;
            timer.Tick += delegate { Tick(); };
        }

        protected override CreateParams CreateParams
        {
            get
            {
                CreateParams cp = base.CreateParams;
                cp.ExStyle |= N.WS_EX_LAYERED;
                return cp;
            }
        }

        protected override void OnLoad(EventArgs e)
        {
            base.OnLoad(e);
            Relayout();
            N.RegisterHotKey(Handle, HOTKEY_ID, 0x1 | 0x2 | 0x4000, (uint)Keys.I); // Ctrl+Alt+I, sans répétition
            hooks.Add(N.SetWinEventHook(N.EVENT_SYSTEM_FOREGROUND, N.EVENT_SYSTEM_FOREGROUND, IntPtr.Zero, winEvents, 0, 0, 0));
            hooks.Add(N.SetWinEventHook(N.EVENT_SYSTEM_MINIMIZESTART, N.EVENT_SYSTEM_MINIMIZEEND, IntPtr.Zero, winEvents, 0, 0, 0));
            SystemEvents.DisplaySettingsChanged += OnDisplayChanged;
            timer.Start();
            Search(true);
            if (!mirror.Attached && cfg.SourceTitle == WebCast.Title) WebCast.Launch();
            else if (!mirror.Attached && cfg.AutoMirrorTo && !MirrorTo.Running()) MirrorTo.Launch();
            if (!cfg.Welcomed)
            {
                cfg.Welcomed = true;
                cfg.Save();
                tray.ShowBalloonTip(10000, "iPhone Bureau est lancé",
                    "Glissez le contour pour déplacer le téléphone. Clic droit dessus : réglages. Ctrl+Alt+I : afficher ou masquer.",
                    ToolTipIcon.Info);
            }
        }

        void OnDisplayChanged(object sender, EventArgs e)
        {
            if (IsHandleCreated) BeginInvoke((MethodInvoker)delegate { Relayout(); });
        }

        // ---- Taille et dessin

        // Densité réelle de l'écran qui contient ce point, en pixels par millimètre.
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

        public double BasePpm { get { return cfg.PxPerMm > 0 ? cfg.PxPerMm : DetectPpm(Center); } }

        public void Relayout()
        {
            Rectangle wa = Screen.PrimaryScreen.WorkingArea;
            bool placed = cfg.PosX != int.MinValue;
            Point probe = placed ? new Point(cfg.PosX + 60, cfg.PosY + 60) : new Point(wa.Right - 60, wa.Bottom - 60);
            double ppm = cfg.PxPerMm > 0 ? cfg.PxPerMm : DetectPpm(probe);
            L = new Layout(ppm * cfg.Scale / 100.0);
            Point pos = placed
                ? new Point(cfg.PosX, cfg.PosY)
                : new Point(wa.Right - L.Size.Width - 40, wa.Bottom - L.Size.Height);
            // Toujours au moins un bout du téléphone visible sur un écran.
            Rectangle vs = SystemInformation.VirtualScreen;
            pos.X = Math.Max(vs.Left - L.Size.Width / 2, Math.Min(pos.X, vs.Right - L.Size.Width / 2));
            pos.Y = Math.Max(vs.Top, Math.Min(pos.Y, vs.Bottom - L.Size.Height / 3));
            Bounds = new Rectangle(pos, L.Size);
            shown = (ScreenState)(-1);
            Render();
            Sync();
        }

        ScreenState WantedState()
        {
            if (!mirror.Attached) return ScreenState.NoSource;
            return mirror.Iconic ? ScreenState.Asleep : ScreenState.Mirror;
        }

        void Render()
        {
            ScreenState st = WantedState();
            DateTime now = DateTime.Now;
            if (st == shown && (st == ScreenState.Mirror || now.Minute == shownMinute)) return;
            spots.Clear();
            using (Bitmap bmp = Renderer.Draw(L, Scheme.Find(cfg.Color), st, spots, now, MirrorTo.FindExe() != null))
                SetBitmap(bmp);
            shown = st;
            shownMinute = now.Minute;
        }

        void SetBitmap(Bitmap bmp)
        {
            IntPtr screenDc = N.GetDC(IntPtr.Zero);
            IntPtr memDc = N.CreateCompatibleDC(screenDc);
            IntPtr hBmp = bmp.GetHbitmap(Color.FromArgb(0));
            IntPtr old = N.SelectObject(memDc, hBmp);
            try
            {
                N.SIZE size = new N.SIZE(bmp.Width, bmp.Height);
                N.POINT src = new N.POINT(0, 0), dst = new N.POINT(Left, Top);
                N.BLENDFUNCTION blend = new N.BLENDFUNCTION();
                blend.SourceConstantAlpha = 255;
                blend.AlphaFormat = 1; // AC_SRC_ALPHA
                N.UpdateLayeredWindow(Handle, screenDc, ref dst, ref size, memDc, ref src, 0, ref blend, 2);
            }
            finally
            {
                N.SelectObject(memDc, old);
                N.DeleteObject(hBmp);
                N.DeleteDC(memDc);
                N.ReleaseDC(IntPtr.Zero, screenDc);
            }
        }

        // ---- Recopie

        void Search(bool force)
        {
            if (mirror.Attached || !Visible) return;
            if (!force && (DateTime.Now - lastSearch).TotalSeconds < 2) return;
            lastSearch = DateTime.Now;
            Candidate c = Finder.Find(cfg);
            if (c != null) AttachTo(c);
        }

        void AttachTo(Candidate c)
        {
            mirror.Detach();
            UnhookSource();
            mirror.Attach(c);
            hooks.Add(N.SetWinEventHook(N.EVENT_OBJECT_LOCATIONCHANGE, N.EVENT_OBJECT_LOCATIONCHANGE, IntPtr.Zero, winEvents, c.Pid, 0, 0));
            Render();
            Sync();
        }

        void UnhookSource()
        {
            while (hooks.Count > 2)
            {
                N.UnhookWinEvent(hooks[hooks.Count - 1]);
                hooks.RemoveAt(hooks.Count - 1);
            }
        }

        void OnWinEvent(IntPtr hook, uint ev, IntPtr hwnd, int idObject, int idChild, uint thread, uint time)
        {
            if (!mirror.Attached) return;
            if (ev == N.EVENT_OBJECT_LOCATIONCHANGE && (hwnd != mirror.Hwnd || idObject != 0)) return;
            if ((ev == N.EVENT_SYSTEM_MINIMIZESTART || ev == N.EVENT_SYSTEM_MINIMIZEEND) && hwnd != mirror.Hwnd) return;
            Sync();
        }

        public void Sync()
        {
            if (syncing || L == null) return;
            syncing = true;
            try
            {
                if (mirror.Attached && !mirror.Alive)
                {
                    mirror.Forget();
                    UnhookSource();
                }
                Render();
                if (!mirror.Attached || mirror.Iconic || !Visible) return;
                Rectangle hole = new Rectangle(Left + L.Screen.X, Top + L.Screen.Y, L.Screen.Width, L.Screen.Height);
                mirror.Place(hole, (int)Math.Round(L.ScreenRadius), cfg);
                mirror.KeepBelow(Handle, cfg.TopMost);
                if (mirror.Blocked && !warnedBlocked)
                {
                    warnedBlocked = true;
                    tray.ShowBalloonTip(12000, mirror.Process + " tourne en administrateur",
                        "Windows empêche de la placer dans le téléphone. Clic droit sur le widget > Relancer en administrateur.", ToolTipIcon.Warning);
                }
            }
            finally { syncing = false; }
        }

        void Tick()
        {
            Search(false);
            Sync();
        }

        // ---- Souris, raccourci, menu

        protected override void OnMouseDown(MouseEventArgs e)
        {
            base.OnMouseDown(e);
            if (e.Button == MouseButtons.Right) { menu.Show(Cursor.Position); return; }
            if (e.Button != MouseButtons.Left) return;
            foreach (HotSpot s in spots)
                if (s.Rect.Contains(e.Location)) { Do(s.Action); return; }
            // Glisser le contour déplace le téléphone (et la recopie avec lui).
            N.ReleaseCapture();
            N.SendMessage(Handle, 0xA1, new IntPtr(2), IntPtr.Zero);
            cfg.PosX = Left; cfg.PosY = Top;
            cfg.Save();
            if (cfg.PxPerMm <= 0 && Math.Abs(DetectPpm(Center) * cfg.Scale / 100.0 - L.Ppm) > 0.01) Relayout();
        }

        protected override void OnMove(EventArgs e)
        {
            base.OnMove(e);
            Sync();
        }

        protected override void WndProc(ref Message m)
        {
            if (m.Msg == 0x0312 && m.WParam.ToInt32() == HOTKEY_ID) { Toggle(); return; }
            if (m.Msg == WM_SHOW_ME && WM_SHOW_ME != 0) { ShowAll(); return; }
            if (m.Msg == WM_QUIT_ME && WM_QUIT_ME != 0) { Close(); return; }
            if (m.Msg == 0x02E0) return; // WM_DPICHANGED : la taille réelle est recalculée après le déplacement.
            base.WndProc(ref m);
        }

        void Do(string action)
        {
            switch (action)
            {
                case "chercher":
                    Search(true);
                    if (!mirror.Attached)
                        tray.ShowBalloonTip(6000, "Aucune recopie trouvée",
                            "Lancez la recopie de l'iPhone vers le PC, puis réessayez. Sinon : « Choisir la fenêtre… ».", ToolTipIcon.Warning);
                    break;
                case "choisir": ChooseWindow(); break;
                case "liens": OpenPhoneLink(); break;
                case "webcast":
                    // Recopie par le navigateur : Edge est déjà autorisé par le pare-feu, rien à débloquer.
                    mirror.Detach(); UnhookSource();
                    cfg.SourceProcess = "msedge"; cfg.SourceTitle = WebCast.Title;
                    cfg.CropTop = cfg.CropBottom = cfg.CropLeft = cfg.CropRight = 0;
                    cfg.AutoMirrorTo = false;
                    cfg.Save();
                    if (!WebCast.Launch())
                        tray.ShowBalloonTip(6000, "Edge introuvable", "Ouvrez webcast.airdroid.com dans votre navigateur, puis « Choisir la fenêtre… ».", ToolTipIcon.Warning);
                    lastSearch = DateTime.MinValue;
                    break;
                case "mirrorto":
                    if (!MirrorTo.Launch())
                        tray.ShowBalloonTip(6000, "MirrorTo introuvable", "Réinstallez-le avec la commande de la page d'aide, ou choisissez une autre appli de recopie.", ToolTipIcon.Warning);
                    break;
                case "reveiller":
                    if (mirror.Attached)
                    {
                        N.ShowWindow(mirror.Hwnd, N.SW_SHOWNOACTIVATE);
                        Sync();
                        N.SetForegroundWindow(mirror.Hwnd);
                    }
                    break;
            }
        }

        void Toggle()
        {
            IntPtr fg = N.GetForegroundWindow();
            if (Visible && (fg == Handle || (mirror.Attached && fg == mirror.Hwnd))) HideAll();
            else ShowAll();
        }

        void HideAll()
        {
            if (mirror.Attached && !mirror.Iconic) N.ShowWindow(mirror.Hwnd, N.SW_MINIMIZE);
            Hide();
        }

        void ShowAll()
        {
            if (!Visible) Show();
            if (mirror.Attached && mirror.Iconic) N.ShowWindow(mirror.Hwnd, N.SW_SHOWNOACTIVATE);
            N.SetWindowPos(Handle, cfg.TopMost ? N.HWND_TOPMOST : N.HWND_TOP, 0, 0, 0, 0, N.SWP_NOMOVE | N.SWP_NOSIZE);
            Search(true);
            Sync();
            // Le clavier va directement à l'iPhone : on peut taper un message tout de suite.
            if (mirror.Attached) N.SetForegroundWindow(mirror.Hwnd);
            else Activate();
        }

        static void OpenPhoneLink()
        {
            try { Process.Start("explorer.exe", "shell:AppsFolder\\Microsoft.YourPhone_8wekyb3d8bbwe!App"); }
            catch { try { Process.Start("ms-phone:"); } catch { } }
        }

        ToolStripMenuItem itemSource, itemTop, itemStartup, itemSize, itemColor, itemAutoMirror;

        void BuildMenu()
        {
            menu = new ContextMenuStrip();
            itemSource = new ToolStripMenuItem("Aucune recopie branchée");
            itemSource.Enabled = false;
            menu.Items.Add(itemSource);
            menu.Items.Add(new ToolStripSeparator());
            menu.Items.Add("Rechercher l'écran de l'iPhone", null, delegate { Do("chercher"); });
            menu.Items.Add("Choisir la fenêtre de recopie…", null, delegate { ChooseWindow(); });
            menu.Items.Add("Régler le cadrage…", null, delegate { CropDialog(); });
            menu.Items.Add("Débrancher la recopie", null, delegate
            {
                mirror.Detach(); UnhookSource();
                cfg.SourceProcess = ""; cfg.SourceTitle = ""; cfg.Save();
                lastSearch = DateTime.Now.AddSeconds(30); // laisse le temps de choisir une autre fenêtre
                Sync();
            });
            menu.Items.Add(new ToolStripSeparator());

            itemTop = new ToolStripMenuItem("Toujours au premier plan", null, delegate
            {
                cfg.TopMost = !cfg.TopMost; cfg.Save();
                TopMost = cfg.TopMost;
                if (!cfg.TopMost) mirror.DropTopMost();
                Sync();
            });
            menu.Items.Add(itemTop);

            itemSize = new ToolStripMenuItem("Taille");
            int[] scales = new int[] { 100, 115, 130, 150, 175, 200 };
            foreach (int sc in scales)
            {
                int v = sc;
                ToolStripMenuItem it = new ToolStripMenuItem(v == 100 ? "Taille réelle (100 %)" : v + " %", null, delegate
                {
                    cfg.Scale = v; cfg.Save(); Relayout();
                });
                it.Tag = v;
                itemSize.DropDownItems.Add(it);
            }
            itemSize.DropDownItems.Add(new ToolStripSeparator());
            itemSize.DropDownItems.Add("Calibrer la taille réelle…", null, delegate { CalibrateDialog(); });
            menu.Items.Add(itemSize);

            itemColor = new ToolStripMenuItem("Couleur");
            foreach (Scheme s in Scheme.All)
            {
                Scheme sc = s;
                ToolStripMenuItem it = new ToolStripMenuItem(s.Label, null, delegate
                {
                    cfg.Color = sc.Id; cfg.Save(); shown = (ScreenState)(-1); Render();
                });
                it.Tag = s.Id;
                itemColor.DropDownItems.Add(it);
            }
            menu.Items.Add(itemColor);
            menu.Items.Add(new ToolStripSeparator());
            menu.Items.Add("Recopie gratuite (AirDroid Cast Web)", null, delegate { Do("webcast"); });
            menu.Items.Add("Ouvrir MirrorTo", null, delegate { Do("mirrorto"); });
            itemAutoMirror = new ToolStripMenuItem("Ouvrir MirrorTo avec le widget", null, delegate { cfg.AutoMirrorTo = !cfg.AutoMirrorTo; cfg.Save(); });
            menu.Items.Add(itemAutoMirror);
            menu.Items.Add("Ouvrir Lien mobile (messages, appels)", null, delegate { OpenPhoneLink(); });
            itemStartup = new ToolStripMenuItem("Lancer au démarrage de Windows", null, delegate { SetStartup(!IsStartup()); });
            menu.Items.Add(itemStartup);
            menu.Items.Add("Afficher / masquer (Ctrl+Alt+I)", null, delegate { Toggle(); });
            menu.Items.Add("Relancer en administrateur", null, delegate { RestartElevated(); });
            menu.Items.Add(new ToolStripSeparator());
            menu.Items.Add("Quitter", null, delegate { Close(); });

            menu.Opening += delegate
            {
                itemSource.Text = mirror.Attached ? "Écran : " + Shorten(mirror.Title, 40) + " (" + mirror.Process + ")" : "Aucune recopie branchée";
                itemTop.Checked = cfg.TopMost;
                itemStartup.Checked = IsStartup();
                itemAutoMirror.Checked = cfg.AutoMirrorTo;
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

        // Nécessaire quand l'appli de recopie est elle-même lancée en administrateur.
        void RestartElevated()
        {
            try
            {
                ProcessStartInfo psi = new ProcessStartInfo(Application.ExecutablePath, "--attendre");
                psi.Verb = "runas";
                psi.UseShellExecute = true;
                Process.Start(psi);
                Close(); // la nouvelle instance attend que celle-ci ait rendu la main
            }
            catch { } // l'utilisateur a refusé la demande d'autorisation
        }

        static string Shorten(string s, int n) { return s.Length <= n ? s : s.Substring(0, n - 1) + "…"; }

        const string RunKey = @"Software\Microsoft\Windows\CurrentVersion\Run";

        static bool IsStartup()
        {
            using (RegistryKey k = Registry.CurrentUser.OpenSubKey(RunKey))
                return k != null && k.GetValue("iPhoneBureau") != null;
        }

        static void SetStartup(bool on)
        {
            using (RegistryKey k = Registry.CurrentUser.CreateSubKey(RunKey))
            {
                if (on) k.SetValue("iPhoneBureau", "\"" + Application.ExecutablePath + "\"");
                else if (k.GetValue("iPhoneBureau") != null) k.DeleteValue("iPhoneBureau");
            }
        }

        // ---- Boîtes de dialogue

        static Form Dialog(string title, int w, int h)
        {
            Form f = new Form();
            f.Text = title;
            f.AutoScaleMode = AutoScaleMode.Dpi;
            f.AutoScaleDimensions = new SizeF(96f, 96f);
            f.FormBorderStyle = FormBorderStyle.FixedDialog;
            f.MaximizeBox = false; f.MinimizeBox = false;
            f.StartPosition = FormStartPosition.CenterScreen;
            f.TopMost = true;
            f.ClientSize = new Size(w, h);
            f.Font = new Font("Segoe UI", 9.5f);
            return f;
        }

        void ChooseWindow()
        {
            List<Candidate> list = Finder.List();
            using (Form f = Dialog("Quelle fenêtre affiche votre iPhone ?", 560, 400))
            {
                Label lab = new Label();
                lab.Text = "Lancez la recopie de l'iPhone sur le PC, puis choisissez sa fenêtre :";
                lab.SetBounds(12, 10, 536, 24);
                ListBox lb = new ListBox();
                lb.SetBounds(12, 38, 536, 300);
                lb.IntegralHeight = false;
                foreach (Candidate c in list) lb.Items.Add(c);
                Button refresh = new Button(); refresh.Text = "Actualiser"; refresh.SetBounds(12, 352, 110, 32);
                Button ok = new Button(); ok.Text = "Afficher dans l'iPhone"; ok.SetBounds(330, 352, 218, 32);
                ok.DialogResult = DialogResult.OK;
                refresh.Click += delegate
                {
                    lb.Items.Clear();
                    foreach (Candidate c in Finder.List()) lb.Items.Add(c);
                };
                lb.DoubleClick += delegate { if (lb.SelectedItem != null) { f.DialogResult = DialogResult.OK; f.Close(); } };
                f.Controls.AddRange(new Control[] { lab, lb, refresh, ok });
                f.AcceptButton = ok;
                if (f.ShowDialog() == DialogResult.OK && lb.SelectedItem != null)
                {
                    Candidate c = (Candidate)lb.SelectedItem;
                    cfg.SourceProcess = c.Process;
                    cfg.SourceTitle = c.Title;
                    cfg.Save();
                    if (!N.IsWindow(c.Hwnd)) { Search(true); return; }
                    AttachTo(c);
                }
            }
        }

        void CropDialog()
        {
            using (Form f = Dialog("Cadrage de l'écran", 400, 300))
            {
                Label help = new Label();
                help.Text = "Masque les barres d'outils de l'appli de recopie (en pixels). Les changements s'affichent tout de suite.";
                help.SetBounds(12, 10, 376, 44);
                f.Controls.Add(help);
                string[] names = new string[] { "Haut", "Bas", "Gauche", "Droite" };
                NumericUpDown[] boxes = new NumericUpDown[4];
                int[] values = new int[] { cfg.CropTop, cfg.CropBottom, cfg.CropLeft, cfg.CropRight };
                for (int i = 0; i < 4; i++)
                {
                    Label l = new Label(); l.Text = names[i]; l.SetBounds(12 + (i % 2) * 190, 66 + (i / 2) * 44, 70, 26);
                    NumericUpDown n = new NumericUpDown();
                    n.Minimum = 0; n.Maximum = 800; n.Value = Math.Max(0, Math.Min(800, values[i]));
                    n.SetBounds(84 + (i % 2) * 190, 62 + (i / 2) * 44, 90, 28);
                    n.ValueChanged += delegate
                    {
                        cfg.CropTop = (int)boxes[0].Value; cfg.CropBottom = (int)boxes[1].Value;
                        cfg.CropLeft = (int)boxes[2].Value; cfg.CropRight = (int)boxes[3].Value;
                        Sync();
                    };
                    boxes[i] = n;
                    f.Controls.Add(l); f.Controls.Add(n);
                }
                Button auto = new Button(); auto.Text = "Enlever les bandes noires"; auto.SetBounds(12, 160, 376, 34);
                auto.Click += delegate
                {
                    int t, b, l, r;
                    if (!mirror.Attached || !mirror.MeasureBlackBars(out t, out b, out l, out r))
                    {
                        MessageBox.Show(f, "Impossible de lire l'image de la recopie. Réglez les valeurs à la main.", "Cadrage");
                        return;
                    }
                    boxes[0].Value = Math.Min(800, t); boxes[1].Value = Math.Min(800, b);
                    boxes[2].Value = Math.Min(800, l); boxes[3].Value = Math.Min(800, r);
                };
                Button reset = new Button(); reset.Text = "Remettre à zéro"; reset.SetBounds(12, 204, 180, 34);
                reset.Click += delegate { foreach (NumericUpDown n in boxes) n.Value = 0; };
                Button ok = new Button(); ok.Text = "Terminé"; ok.SetBounds(208, 248, 180, 38);
                ok.DialogResult = DialogResult.OK;
                f.Controls.AddRange(new Control[] { auto, reset, ok });
                f.AcceptButton = ok;
                f.ShowDialog();
                cfg.Save();
            }
        }

        void CalibrateDialog()
        {
            double start = BasePpm;
            using (Form f = Dialog("Calibrer la taille réelle", 640, 470))
            {
                f.AutoScaleMode = AutoScaleMode.None; // la carte doit être dessinée en vrais pixels
                Label help = new Label();
                help.Text = "Posez une carte bancaire contre l'écran et réglez le curseur pour que le rectangle ait exactement sa largeur.";
                help.SetBounds(12, 10, 616, 44);
                double ppm = start;
                Panel card = new Panel();
                card.SetBounds(12, 60, 616, 300);
                card.Paint += delegate(object s, PaintEventArgs e)
                {
                    e.Graphics.SmoothingMode = SmoothingMode.AntiAlias;
                    float w = (float)(85.6 * ppm), h = (float)(53.98 * ppm);
                    RectangleF r = new RectangleF(4, 4, w, h);
                    using (GraphicsPath p = Renderer.RoundRect(r, (float)(3.2 * ppm)))
                    {
                        using (LinearGradientBrush b = new LinearGradientBrush(r, Color.FromArgb(40, 70, 160), Color.FromArgb(120, 60, 170), LinearGradientMode.ForwardDiagonal))
                            e.Graphics.FillPath(b, p);
                        e.Graphics.DrawPath(Pens.Black, p);
                    }
                    using (Font fo = new Font("Segoe UI", 11f))
                        e.Graphics.DrawString("Carte bancaire · 85,6 mm", fo, Brushes.White, 14, 14);
                };
                TrackBar tb = new TrackBar();
                tb.Minimum = 150; tb.Maximum = 1600; tb.TickFrequency = 50;
                tb.Value = (int)Math.Max(150, Math.Min(1600, Math.Round(start * 100)));
                tb.SetBounds(12, 366, 616, 40);
                Button autoB = new Button(); autoB.Text = "Mesure automatique"; autoB.SetBounds(12, 420, 200, 38);
                Button ok = new Button(); ok.Text = "Enregistrer"; ok.SetBounds(428, 420, 200, 38);
                Action fit = delegate
                {
                    int needW = (int)(85.6 * ppm) + 40, needH = (int)(53.98 * ppm) + 20;
                    card.Width = Math.Max(616, needW); card.Height = Math.Max(300, needH);
                    tb.Top = card.Bottom + 6; tb.Width = card.Width;
                    autoB.Top = ok.Top = tb.Bottom + 14;
                    ok.Left = card.Right - ok.Width;
                    f.ClientSize = new Size(card.Right + 12, ok.Bottom + 12);
                    card.Invalidate();
                };
                tb.ValueChanged += delegate { ppm = tb.Value / 100.0; fit(); };
                autoB.Click += delegate { cfg.PxPerMm = 0; cfg.Save(); Relayout(); f.DialogResult = DialogResult.Cancel; f.Close(); };
                ok.DialogResult = DialogResult.OK;
                f.Controls.AddRange(new Control[] { help, card, tb, autoB, ok });
                fit();
                if (f.ShowDialog() == DialogResult.OK)
                {
                    cfg.PxPerMm = ppm;
                    cfg.Save();
                    Relayout();
                }
            }
        }

        protected override void OnFormClosing(FormClosingEventArgs e)
        {
            timer.Stop();
            SystemEvents.DisplaySettingsChanged -= OnDisplayChanged;
            foreach (IntPtr h in hooks) if (h != IntPtr.Zero) N.UnhookWinEvent(h);
            hooks.Clear();
            N.UnregisterHotKey(Handle, HOTKEY_ID);
            mirror.Detach();
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
            if (args.Length == 2 && args[0] == "--icone") { Renderer.WriteIco(args[1]); return; }
            if (args.Length == 1 && args[0] == "--quitter")
            {
                // Fermeture propre : le widget rend sa forme d'origine à la fenêtre de recopie.
                N.PostMessage(N.HWND_BROADCAST, N.RegisterWindowMessage("iPhoneBureau_Quitter"), IntPtr.Zero, IntPtr.Zero);
                return;
            }
            try { N.SetProcessDpiAwarenessContext(new IntPtr(-4)); } catch { }

            bool created;
            using (Mutex mutex = new Mutex(true, "Local\\iPhoneBureau_Widget", out created))
            {
                if (!created && Array.IndexOf(args, "--attendre") >= 0)
                {
                    try { created = mutex.WaitOne(8000); }
                    catch (AbandonedMutexException) { created = true; }
                }
                if (!created)
                {
                    // Déjà lancé : on demande simplement au widget existant de se montrer.
                    N.PostMessage(N.HWND_BROADCAST, N.RegisterWindowMessage("iPhoneBureau_Afficher"), IntPtr.Zero, IntPtr.Zero);
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

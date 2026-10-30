// Dan't Bureau : les 3 widgets Dan't Procrastiner posés sur le bureau Windows, par-dessus le fond d'écran
// (Lively et les widgets du tracker restent en place). Une fenêtre sans bord, découpée à la forme exacte des
// widgets, toujours au fond de la pile : elle ne passe jamais devant tes fenêtres.
// Compilé sur le PC par Installer.ps1 (C# 5, .NET Framework 4.x + WebView2 de Microsoft).
using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.Drawing;
using System.Drawing.Drawing2D;
using System.IO;
using System.Runtime.InteropServices;
using System.Threading;
using System.Windows.Forms;
using Microsoft.Win32;
using Microsoft.Web.WebView2.Core;
using Microsoft.Web.WebView2.WinForms;

namespace DantBureau
{
    static class N
    {
        [DllImport("user32.dll")] public static extern bool SetProcessDPIAware();
        [DllImport("user32.dll")] public static extern bool ReleaseCapture();
        [DllImport("user32.dll")] public static extern IntPtr SendMessage(IntPtr h, int msg, IntPtr w, IntPtr l);
        [DllImport("user32.dll")] public static extern bool SetWindowPos(IntPtr h, IntPtr after, int x, int y, int cx, int cy, uint flags);
        [DllImport("user32.dll")] public static extern bool IsIconic(IntPtr h);
        [DllImport("user32.dll")] public static extern bool ShowWindow(IntPtr h, int cmd);
        public static readonly IntPtr HWND_BOTTOM = new IntPtr(1);
        public const int WM_NCLBUTTONDOWN = 0xA1, HTCAPTION = 2, WM_WINDOWPOSCHANGING = 0x46, WM_SYSCOMMAND = 0x112, SC_MINIMIZE = 0xF020;
        public const uint SWP_NOSIZE = 0x1, SWP_NOMOVE = 0x2, SWP_NOZORDER = 0x4, SWP_NOACTIVATE = 0x10;
        public const int WS_EX_TOOLWINDOW = 0x80, SW_SHOWNOACTIVATE = 4;
        [StructLayout(LayoutKind.Sequential)]
        public struct WINDOWPOS { public IntPtr hwnd, after; public int x, y, cx, cy; public uint flags; }
    }

    // Réglages : %LOCALAPPDATA%\DantBureau\reglages.txt (cle=valeur)
    class Config
    {
        public static readonly string Dir = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "DantBureau");
        static readonly string FilePath = Path.Combine(Dir, "reglages.txt");
        readonly Dictionary<string, string> v = new Dictionary<string, string>();
        public Config()
        {
            try { foreach (string l in File.ReadAllLines(FilePath)) { int i = l.IndexOf('='); if (i > 0) v[l.Substring(0, i).Trim()] = l.Substring(i + 1).Trim(); } } catch { }
        }
        public string Get(string k, string d) { string s; return v.TryGetValue(k, out s) && s.Length > 0 ? s : d; }
        public int GetInt(string k, int d) { int n; return int.TryParse(Get(k, ""), out n) ? n : d; }
        public void Set(string k, object val)
        {
            v[k] = Convert.ToString(val);
            try
            {
                Directory.CreateDirectory(Dir);
                var lines = new List<string>();
                foreach (var kv in v) lines.Add(kv.Key + "=" + kv.Value);
                File.WriteAllLines(FilePath, lines.ToArray());
            }
            catch { }
        }
    }

    static class Program
    {
        public const string Site = "https://pierrernrd04-ai.github.io/Vous-/dant-procrastiner/";
        public const string RunKey = @"Software\Microsoft\Windows\CurrentVersion\Run";

        [STAThread]
        static void Main(string[] args)
        {
            var quit = new EventWaitHandle(false, EventResetMode.AutoReset, "DantBureau-quitter");
            if (args.Length > 0 && args[0] == "--quitter") { quit.Set(); return; }
            bool first;
            var mutex = new Mutex(true, "DantBureau-unique", out first);
            if (!first) return; // déjà lancé
            try { N.SetProcessDPIAware(); } catch { }
            Application.EnableVisualStyles();
            Application.SetCompatibleTextRenderingDefault(false);
            if (string.IsNullOrEmpty(CoreVersion()))
            {
                if (MessageBox.Show("Dan't Bureau a besoin de Microsoft Edge WebView2 (déjà présent sur Windows 11).\n\nOuvrir la page de téléchargement de Microsoft ?",
                    "Dan't Bureau", MessageBoxButtons.YesNo, MessageBoxIcon.Information) == DialogResult.Yes)
                    Open("https://go.microsoft.com/fwlink/p/?LinkId=2124703");
                return;
            }
            var form = new DeskForm();
            ThreadPool.RegisterWaitForSingleObject(quit, delegate { try { form.BeginInvoke((Action)form.Quit); } catch { } }, null, -1, true);
            Application.Run(form);
            GC.KeepAlive(mutex);
        }

        static string CoreVersion()
        {
            try { return CoreWebView2Environment.GetAvailableBrowserVersionString(); } catch { return null; }
        }

        public static void Open(string url)
        {
            try { Process.Start(new ProcessStartInfo(url) { UseShellExecute = true }); } catch { }
        }

        public static string ParseCode(string s)
        {
            const string A = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";
            string c = "";
            foreach (char ch in (s ?? "").ToUpperInvariant())
            {
                char x = ch == 'O' ? '0' : (ch == 'I' || ch == 'L') ? '1' : ch;
                if (A.IndexOf(x) >= 0) c += x;
            }
            return c.Length == 12 ? c.Substring(0, 4) + "-" + c.Substring(4, 4) + "-" + c.Substring(8, 4) : null;
        }

        // Petite fenêtre de saisie du code de liaison (affiché sur l'iPhone : Dan't › ⚙️ › Widgets sur le PC)
        public static string AskCode(string current)
        {
            using (var f = new Form())
            {
                f.Text = "Dan't Bureau";
                f.FormBorderStyle = FormBorderStyle.FixedDialog;
                f.MaximizeBox = false; f.MinimizeBox = false;
                f.StartPosition = FormStartPosition.CenterScreen;
                f.ClientSize = new Size(420, 190);
                f.Font = new Font("Segoe UI", 10f);
                f.TopMost = true;
                var lbl = new Label { Left = 18, Top = 16, Width = 384, Height = 60, Text = "Sur ton iPhone : Dan't › ⚙️ › Widgets sur le PC › Activer les widgets PC.\nTape ici le code affiché (12 caractères)." };
                var box = new TextBox { Left = 18, Top = 82, Width = 384, Font = new Font("Consolas", 16f), CharacterCasing = CharacterCasing.Upper, Text = current ?? "" };
                var err = new Label { Left = 18, Top = 122, Width = 250, Height = 40, ForeColor = Color.FromArgb(224, 23, 125) };
                var ok = new Button { Text = "Relier", Left = 300, Top = 140, Width = 102, Height = 34 };
                f.Controls.AddRange(new Control[] { lbl, box, err, ok });
                f.AcceptButton = ok;
                string result = null;
                ok.Click += delegate
                {
                    result = ParseCode(box.Text);
                    if (result == null) { err.Text = "Le code fait 12 caractères,\ncomme 7KQ2-M9XF-3HWD."; return; }
                    f.DialogResult = DialogResult.OK;
                };
                return f.ShowDialog() == DialogResult.OK ? result : null;
            }
        }

        // Icône dessinée ici : carré rose arrondi et coche vert fluo
        public static Icon MakeIcon()
        {
            var bmp = new Bitmap(64, 64);
            using (var g = Graphics.FromImage(bmp))
            {
                g.SmoothingMode = SmoothingMode.AntiAlias;
                using (var path = Rounded(new RectangleF(2, 2, 60, 60), 15))
                using (var br = new LinearGradientBrush(new Rectangle(0, 0, 64, 64), Color.FromArgb(255, 46, 147), Color.FromArgb(127, 211, 255), 45f))
                    g.FillPath(br, path);
                g.FillEllipse(new SolidBrush(Color.FromArgb(11, 22, 51)), 13, 13, 38, 38);
                using (var pen = new Pen(Color.FromArgb(57, 255, 136), 6f) { StartCap = LineCap.Round, EndCap = LineCap.Round, LineJoin = LineJoin.Round })
                    g.DrawLines(pen, new[] { new PointF(22, 33), new PointF(29, 40), new PointF(43, 25) });
            }
            return Icon.FromHandle(bmp.GetHicon());
        }

        public static GraphicsPath Rounded(RectangleF r, float rad)
        {
            var p = new GraphicsPath();
            float d = rad * 2;
            p.AddArc(r.X, r.Y, d, d, 180, 90);
            p.AddArc(r.Right - d, r.Y, d, d, 270, 90);
            p.AddArc(r.Right - d, r.Bottom - d, d, d, 0, 90);
            p.AddArc(r.X, r.Bottom - d, d, d, 90, 90);
            p.CloseFigure();
            return p;
        }
    }

    class DeskForm : Form
    {
        readonly Config cfg = new Config();
        readonly WebView2 web = new WebView2();
        readonly NotifyIcon tray = new NotifyIcon();
        readonly ContextMenuStrip menu = new ContextMenuStrip();
        readonly System.Windows.Forms.Timer guard = new System.Windows.Forms.Timer();
        float scale = 1f;
        bool quitting;

        public DeskForm()
        {
            Text = "Dan't Bureau";
            FormBorderStyle = FormBorderStyle.None;
            ShowInTaskbar = false;
            StartPosition = FormStartPosition.Manual;
            BackColor = Color.FromArgb(242, 251, 255);
            Icon = Program.MakeIcon();
            using (var g = CreateGraphics()) scale = g.DpiX / 96f;

            web.Dock = DockStyle.Fill;
            web.DefaultBackgroundColor = BackColor;
            web.CreationProperties = new CoreWebView2CreationProperties { UserDataFolder = Path.Combine(Config.Dir, "WebView2") };
            web.CoreWebView2InitializationCompleted += OnReady;
            Controls.Add(web);

            BuildMenu();
            tray.Icon = Icon;
            tray.Text = "Dan't Bureau";
            tray.ContextMenuStrip = menu;
            tray.Visible = true;
            tray.MouseClick += delegate (object s, MouseEventArgs e) { if (e.Button == MouseButtons.Left) Program.Open(Program.Site); };

            // « Afficher le bureau » (Windows + D) ou une réduction : on revient aussitôt
            guard.Interval = 1500;
            guard.Tick += delegate { if (IsHandleCreated && N.IsIconic(Handle)) { N.ShowWindow(Handle, N.SW_SHOWNOACTIVATE); ToBottom(); } };
            guard.Start();

            Layout2();
        }

        protected override CreateParams CreateParams
        {
            get { var cp = base.CreateParams; cp.ExStyle |= N.WS_EX_TOOLWINDOW; return cp; }
        }

        protected override bool ShowWithoutActivation { get { return true; } }

        protected override void OnShown(EventArgs e)
        {
            base.OnShown(e);
            ToBottom();
            if (Program.ParseCode(cfg.Get("code", "")) == null)
            {
                string c = Program.AskCode("");
                if (c != null) cfg.Set("code", c);
            }
            web.EnsureCoreWebView2Async(null);
        }

        // Toujours tout au fond : au-dessus du fond d'écran, sous toutes les fenêtres
        protected override void WndProc(ref Message m)
        {
            if (m.Msg == N.WM_WINDOWPOSCHANGING)
            {
                var wp = (N.WINDOWPOS)Marshal.PtrToStructure(m.LParam, typeof(N.WINDOWPOS));
                wp.after = N.HWND_BOTTOM;
                wp.flags &= ~N.SWP_NOZORDER;
                Marshal.StructureToPtr(wp, m.LParam, false);
            }
            if (m.Msg == N.WM_SYSCOMMAND && ((int)m.WParam & 0xFFF0) == N.SC_MINIMIZE) return;
            base.WndProc(ref m);
        }

        void ToBottom()
        {
            N.SetWindowPos(Handle, N.HWND_BOTTOM, 0, 0, 0, 0, N.SWP_NOMOVE | N.SWP_NOSIZE | N.SWP_NOACTIVATE);
        }

        // Taille et découpe : 2 petits widgets carrés en haut, le grand dessous (mêmes mesures que la page)
        int S { get { return cfg.GetInt("taille", 180); } }
        void Layout2()
        {
            float s = S * scale, g = s * .11f, r = s * .23f;
            int w = (int)Math.Ceiling(2 * s + g), h = (int)Math.Ceiling(3 * s + 2 * g);
            var wa = Screen.PrimaryScreen.WorkingArea;
            int x = cfg.GetInt("x", wa.Right - w - (int)(40 * scale)), y = cfg.GetInt("y", wa.Top + (int)(40 * scale));
            // jamais hors de l'écran (écran débranché, résolution changée)
            bool visible = false;
            foreach (var sc in Screen.AllScreens) if (sc.WorkingArea.IntersectsWith(new Rectangle(x, y, w, h))) visible = true;
            if (!visible) { x = wa.Right - w - (int)(40 * scale); y = wa.Top + (int)(40 * scale); }
            Bounds = new Rectangle(x, y, w, h);
            var path = new GraphicsPath();
            path.AddPath(Program.Rounded(new RectangleF(0, 0, s, s), r), false);
            path.AddPath(Program.Rounded(new RectangleF(s + g, 0, s, s), r), false);
            path.AddPath(Program.Rounded(new RectangleF(0, s + g, 2 * s + g, 2 * s + g), r), false);
            Region = new Region(path);
        }

        string Url()
        {
            string code = Program.ParseCode(cfg.Get("code", "")) ?? "";
            return Program.Site + "widgets/#" + code + "&mode=bureau&s=" + S + "&theme=" + cfg.Get("theme", "clair");
        }

        void OnReady(object sender, CoreWebView2InitializationCompletedEventArgs e)
        {
            if (!e.IsSuccess)
            {
                MessageBox.Show("WebView2 n'a pas pu démarrer : " + (e.InitializationException != null ? e.InitializationException.Message : "erreur inconnue"), "Dan't Bureau");
                return;
            }
            var st = web.CoreWebView2.Settings;
            st.AreDefaultContextMenusEnabled = false;
            st.AreDevToolsEnabled = false;
            st.IsZoomControlEnabled = false;
            st.IsStatusBarEnabled = false;
            // les liens (rappel, appli) s'ouvrent dans le navigateur habituel
            web.CoreWebView2.NewWindowRequested += delegate (object s, CoreWebView2NewWindowRequestedEventArgs a) { a.Handled = true; Program.Open(a.Uri); };
            web.CoreWebView2.WebMessageReceived += OnMessage;
            web.CoreWebView2.Navigate(Url());
        }

        void OnMessage(object sender, CoreWebView2WebMessageReceivedEventArgs e)
        {
            string m;
            try { m = e.TryGetWebMessageAsString(); } catch { return; }
            if (m == "drag")
            {
                N.ReleaseCapture();
                N.SendMessage(Handle, N.WM_NCLBUTTONDOWN, new IntPtr(N.HTCAPTION), IntPtr.Zero);
                cfg.Set("x", Left); cfg.Set("y", Top);
                ToBottom();
            }
            else if (m == "menu") menu.Show(Cursor.Position);
        }

        void Reload()
        {
            Layout2();
            if (web.CoreWebView2 != null) web.CoreWebView2.Navigate(Url());
            ToBottom();
        }

        void BuildMenu()
        {
            menu.Opening += delegate { RefreshChecks(); };
            var size = new ToolStripMenuItem("Taille");
            foreach (var t in new[] { new object[] { "Petite", 150 }, new object[] { "Normale", 180 }, new object[] { "Grande", 220 }, new object[] { "Très grande", 260 } })
            {
                int v = (int)t[1];
                var it = new ToolStripMenuItem((string)t[0]) { Tag = "taille:" + v };
                it.Click += delegate { cfg.Set("taille", v); Reload(); };
                size.DropDownItems.Add(it);
            }
            var theme = new ToolStripMenuItem("Thème");
            foreach (var t in new[] { new[] { "Clair", "clair" }, new[] { "Sombre", "sombre" }, new[] { "Auto (jour / nuit)", "auto" } })
            {
                string v = t[1];
                var it = new ToolStripMenuItem(t[0]) { Tag = "theme:" + v };
                it.Click += delegate { cfg.Set("theme", v); Reload(); };
                theme.DropDownItems.Add(it);
            }
            var place = new ToolStripMenuItem("Placer");
            foreach (var t in new[] { "En haut à droite", "En haut à gauche", "En bas à droite", "En bas à gauche" })
            {
                string v = t;
                var it = new ToolStripMenuItem(v);
                it.Click += delegate { Snap(v); };
                place.DropDownItems.Add(it);
            }
            var auto = new ToolStripMenuItem("Démarrer avec Windows") { Tag = "auto" };
            auto.Click += delegate { SetAutostart(!IsAutostart()); };
            menu.Items.Add(new ToolStripMenuItem("Ouvrir Dan't", null, delegate { Program.Open(Program.Site); }));
            menu.Items.Add(new ToolStripSeparator());
            menu.Items.Add(size);
            menu.Items.Add(theme);
            menu.Items.Add(place);
            menu.Items.Add(new ToolStripMenuItem("Changer le code…", null, delegate
            {
                string c = Program.AskCode(cfg.Get("code", ""));
                if (c != null) { cfg.Set("code", c); Reload(); }
            }));
            menu.Items.Add(new ToolStripMenuItem("Actualiser", null, delegate { Reload(); }));
            menu.Items.Add(auto);
            menu.Items.Add(new ToolStripSeparator());
            menu.Items.Add(new ToolStripMenuItem("Quitter", null, delegate { Quit(); }));
        }

        void RefreshChecks()
        {
            string tk = "taille:" + S, th = "theme:" + cfg.Get("theme", "clair");
            foreach (ToolStripItem top in menu.Items)
            {
                var mi = top as ToolStripMenuItem;
                if (mi == null) continue;
                if ((mi.Tag as string) == "auto") mi.Checked = IsAutostart();
                foreach (ToolStripItem sub in mi.DropDownItems)
                {
                    var si = sub as ToolStripMenuItem;
                    if (si != null && si.Tag is string) si.Checked = (string)si.Tag == tk || (string)si.Tag == th;
                }
            }
        }

        void Snap(string where)
        {
            var wa = Screen.FromControl(this).WorkingArea;
            int m = (int)(40 * scale);
            int x = where.Contains("droite") ? wa.Right - Width - m : wa.Left + m;
            int y = where.Contains("haut") ? wa.Top + m : wa.Bottom - Height - m;
            Location = new Point(x, y);
            cfg.Set("x", x); cfg.Set("y", y);
            ToBottom();
        }

        static bool IsAutostart()
        {
            using (var k = Registry.CurrentUser.OpenSubKey(Program.RunKey)) return k != null && k.GetValue("DantBureau") != null;
        }

        static void SetAutostart(bool on)
        {
            using (var k = Registry.CurrentUser.CreateSubKey(Program.RunKey))
            {
                if (on) k.SetValue("DantBureau", "\"" + Application.ExecutablePath + "\"");
                else k.DeleteValue("DantBureau", false);
            }
        }

        public void Quit()
        {
            quitting = true;
            tray.Visible = false;
            Close();
        }

        protected override void OnFormClosing(FormClosingEventArgs e)
        {
            // Alt + F4 sur les widgets ne les ferme pas par erreur : on passe par le menu « Quitter »
            if (!quitting && e.CloseReason == CloseReason.UserClosing) { e.Cancel = true; return; }
            tray.Visible = false;
            base.OnFormClosing(e);
        }
    }
}

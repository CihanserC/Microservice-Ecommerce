namespace Simulator.Web.SourceCode;

/// <summary>
/// Arayüzün "bu adımı hangi kod yaptı?" sorusuna cevap verebilmesi için repo kaynak kodunu okur.
/// Yalnızca src/ altındaki metin dosyaları okunabilir; kök dışına çıkan yollar reddedilir.
/// </summary>
public sealed class SourceCodeProvider
{
    private static readonly HashSet<string> AllowedExtensions =
        new(StringComparer.OrdinalIgnoreCase) { ".cs", ".json", ".csproj", ".md", ".sql" };

    private readonly string? _root;

    public SourceCodeProvider(IConfiguration configuration, IWebHostEnvironment environment, ILogger<SourceCodeProvider> logger)
    {
        _root = ResolveRoot(configuration["Simulator:SourceRoot"], environment.ContentRootPath);

        if (_root is null)
            logger.LogWarning("Source root could not be found; code viewer will be unavailable");
        else
            logger.LogInformation("Serving source code from {SourceRoot}", _root);
    }

    public bool IsAvailable => _root is not null;

    public async Task<string?> ReadAsync(string relativePath, CancellationToken cancellationToken)
    {
        if (_root is null || string.IsNullOrWhiteSpace(relativePath))
            return null;

        var fullPath = Path.GetFullPath(Path.Combine(_root, relativePath));
        var rootWithSeparator = _root.EndsWith(Path.DirectorySeparatorChar) ? _root : _root + Path.DirectorySeparatorChar;

        if (!fullPath.StartsWith(rootWithSeparator, StringComparison.OrdinalIgnoreCase) ||
            !AllowedExtensions.Contains(Path.GetExtension(fullPath)) ||
            fullPath.Contains($"{Path.DirectorySeparatorChar}bin{Path.DirectorySeparatorChar}") ||
            fullPath.Contains($"{Path.DirectorySeparatorChar}obj{Path.DirectorySeparatorChar}") ||
            !File.Exists(fullPath))
        {
            return null;
        }

        return await File.ReadAllTextAsync(fullPath, cancellationToken);
    }

    /// <summary>
    /// Önce yapılandırma (Docker'da imaja kopyalanan /app/source), yoksa çalışma klasöründen yukarı
    /// çıkıp .slnx dosyasını bularak repo kökünü keşfeder (yerel "dotnet run").
    /// </summary>
    private static string? ResolveRoot(string? configured, string contentRoot)
    {
        if (!string.IsNullOrWhiteSpace(configured))
        {
            var path = Path.GetFullPath(configured);
            return Directory.Exists(path) ? path.TrimEnd(Path.DirectorySeparatorChar) : null;
        }

        for (var dir = new DirectoryInfo(contentRoot); dir is not null; dir = dir.Parent)
        {
            if (dir.EnumerateFiles("*.slnx").Any() && Directory.Exists(Path.Combine(dir.FullName, "src")))
                return Path.Combine(dir.FullName, "src");
        }

        return null;
    }
}

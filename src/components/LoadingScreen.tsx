export default function LoadingScreen() {
  return (
    <div className="flex items-center justify-center min-h-screen bg-background">
      <div className="text-muted-foreground text-sm font-medium animate-pulse">
        Loading...
      </div>
    </div>
  );
}

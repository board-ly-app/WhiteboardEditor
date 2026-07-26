import backgroundVideo from '@/assets/backgroundVideo.mp4';
import backgroundWallpaper from '@/assets/backgroundWallpaper.jpg';

const BackgroundVideo = () => {
  return(
    <div className="fixed inset-0 -z-10 h-full w-full overflow-hidden">
  
      {/* Layer 1: Background Video */}
      <video
        id="backgroundVideo"
        autoPlay
        loop
        muted
        playsInline
        poster={backgroundWallpaper}
        className="absolute inset-0 h-full w-full object-cover"
      >
        <source src={backgroundVideo} type="video/mp4" />
      </video>

      {/* Layer 2: The Vignette Overlay */}
      <div className="absolute inset-0 pointer-events-none bg-[radial-gradient(circle,transparent_50%,rgba(0,0,0,0.6)_120%)]"></div>
    </div>
  );
}

export default BackgroundVideo;

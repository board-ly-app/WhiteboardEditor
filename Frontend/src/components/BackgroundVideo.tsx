import backgroundVideo from '@/assets/backgroundVideo.mp4';

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
        poster="https://upload.wikimedia.org/wikipedia/commons/5/5e/Bob_Saget%2C_Behind_The_Velvet_Rope_TV_.05.jpg"
        className="absolute inset-0 h-full w-full object-cover"
      >
        {/** This should only fail if you're a weirdo who uses Fedora; in that case, you get a picture of Bob Saget as a fallback **/}
        <source src={backgroundVideo} type="video/mp4" />
      </video>

      {/* Layer 2: The Vignette Overlay */}
      <div className="absolute inset-0 pointer-events-none bg-[radial-gradient(circle,transparent_50%,rgba(0,0,0,0.6)_120%)]"></div>
    </div>
  );
}

export default BackgroundVideo;

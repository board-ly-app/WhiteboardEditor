import backgroundVideo from '@/assets/backgroundVideo.mp4';

const BackgroundVideo = () => {
  return(
    <div>
      <video 
        id="backgroundVideo"
        autoPlay
        muted
        loop
        playsInline
        className='fixed inset-0 -z-10 h-full w-full object-cover'
      >
        <source src={backgroundVideo} type="video/mp4" />
        Your browser does not support HTML5 video.
      </video>
    </div>
  );
}

export default BackgroundVideo;
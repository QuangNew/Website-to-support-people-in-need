using Microsoft.AspNetCore.Mvc;

namespace JCIReliefWeb.Controllers
{
    public class SOSController : Controller
    {
        public IActionResult Index()
        {
            ViewData["Title"] = "Cần giúp đỡ";
            return View();
        }

        public IActionResult Create()
        {
            ViewData["Title"] = "Gửi yêu cầu SOS";
            return View();
        }
    }
}

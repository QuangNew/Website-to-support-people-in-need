using Microsoft.AspNetCore.Mvc;

namespace JCIReliefWeb.Controllers
{
    public class MapController : Controller
    {
        public IActionResult Index()
        {
            ViewData["Title"] = "Bản đồ cứu trợ";
            return View();
        }
    }
}
